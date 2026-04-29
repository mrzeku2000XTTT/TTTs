import express from "express";
import { createServer as createViteServer } from "vite";
import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import util from "util";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const execPromise = util.promisify(exec);

async function startServer() {
  const app = express();
  const PORT = 3000;

   app.use(express.json({ limit: '50mb' }));

  // API to upload image for reference and rendering
  app.post("/api/upload-image", async (req, res) => {
    try {
      const { image, mimeType } = req.body;
      if (!image || !mimeType) {
        return res.status(400).json({ error: "Missing image or mimeType" });
      }

      const extension = mimeType.split('/')[1] || 'png';
      const fileName = `${uuidv4()}.${extension}`;
      const uploadDir = path.join(os.tmpdir(), 'uploads');
      
      await fs.mkdir(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, fileName);
      
      // image is expected to be a raw base64 string
      const buffer = Buffer.from(image, 'base64');
      await fs.writeFile(filePath, buffer);

      const url = `/uploads/${fileName}`;
      res.json({ url });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: "Upload failed", details: e.message });
    }
  });

  // Serve uploaded images securely
  app.use('/uploads', express.static(path.join(os.tmpdir(), 'uploads')));

  app.post("/api/scrape-website", async (req, res) => {
    try {
      const { url } = req.body;
      if (!url) {
        return res.status(400).json({ error: "Missing url" });
      }

      // Add https protocol if missing
      let targetUrl = url;
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      const targetUrlObj = new URL(targetUrl);
      const host = targetUrlObj.origin;
      
      let linksToScrape = [targetUrl];
      
      // Attempt to fetch raw HTML to parse out additional internal routes for more feature screenshots
      try {
        const htmlRes = await fetch(targetUrl, { follow: 3, timeout: 5000 } as any);
        const htmlText = await htmlRes.text();
        
        const hrefRegex = /href=["'](\/[^"']+)["']/g;
        let match;
        const foundLinks = new Set<string>();
        
        while ((match = hrefRegex.exec(htmlText)) !== null) {
          let link = match[1];
          // Exclude assets, jumps
          if (!link.includes('.') && link.length > 2 && !link.startsWith('/#')) {
             // Trim trailing slash
             if (link.endsWith('/')) link = link.slice(0, -1);
             foundLinks.add(host + link);
          }
        }
        
        let uniqueLinks = Array.from(foundLinks).filter(l => l !== host && l !== host + '/');

        // Grab top 3 additional unique pages to make 4 total screenshots. No fake fallbacks.
        linksToScrape = [targetUrl, ...uniqueLinks.slice(0, 3)];
      } catch (htmlErr) {
        console.log("Could not parse sub-links. Defaulting to just target URL.", htmlErr);
        linksToScrape = [targetUrl];
      }

      console.log(`Scraping ${linksToScrape.length} pages:`, linksToScrape);

      // Scrape them concurrently using Microlink
      const scrapeResults = await Promise.allSettled(
        linksToScrape.map(async (pageUrl) => {
          const microlinkUrl = `https://api.microlink.io?url=${encodeURIComponent(pageUrl)}&screenshot=true&waitForTimeout=2500&meta=false`;
          const mlResponse = await fetch(microlinkUrl);
          if (!mlResponse.ok) throw new Error("Microlink API failed");
          const mlData = await mlResponse.json();
          
          if (!mlData?.data?.screenshot?.url) throw new Error("No screenshot returned");
          const screenshotUrl = mlData.data.screenshot.url;

          const response = await fetch(screenshotUrl);
          if (!response.ok) throw new Error("Failed to download image");
          
          const arrayBuffer = await response.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const base64 = buffer.toString('base64');
          const mimeType = 'image/png';
          
          const fileName = `${uuidv4()}.png`;
          const uploadDir = path.join(os.tmpdir(), 'uploads');
          await fs.mkdir(uploadDir, { recursive: true });
          const filePath = path.join(uploadDir, fileName);
          await fs.writeFile(filePath, buffer);

          return { url: `/uploads/${fileName}`, base64, mimeType, source: pageUrl };
        })
      );

      let successfulImages = scrapeResults
        .filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled')
        .map(r => r.value);
        
      // Super simple de-duplication heuristic: if screenshots are the exact same byte length (+- 100 bytes to account for timestamps/micro changes), they are likely the same 404 SPA fallback page.
      const uniqueImages = [];
      for (const img of successfulImages) {
        const isDuplicate = uniqueImages.some(uImg => Math.abs(uImg.base64.length - img.base64.length) < 500);
        if (!isDuplicate) {
          uniqueImages.push(img);
        }
      }

      if (uniqueImages.length === 0) {
        throw new Error("All page scrapes failed");
      }

      res.json({ images: uniqueImages });
    } catch (e: any) {
      console.error("Scrape failed", e);
      res.status(500).json({ error: "Scrape failed", details: e.message });
    }
  });

  // API to render the hyperframe composition
  app.post("/api/render", async (req, res) => {
    const { html } = req.body;
    if (!html) {
      return res.status(400).json({ error: "No HTML provided" });
    }

    const projectId = uuidv4();
    const tempDir = path.join(os.tmpdir(), `hyperframes-${projectId}`);
    
    try {
      console.log(`Creating project at ${tempDir}`);
      await fs.mkdir(tempDir, { recursive: true });
      
      const projectName = "project";
      const projectDir = path.join(tempDir, projectName);

      // Initialize project. hyperframes init doesn't support an explicit path correctly so we run it from the temp folder
      // Wait, hyperframes init creates a subfolder.
      await execPromise(`npx -y hyperframes init ${projectName} --example blank --non-interactive`, { cwd: tempDir });
      
      // Overwrite the index.html
      await fs.writeFile(path.join(projectDir, "index.html"), html, "utf-8");

      // Sync public folder assets (like uploads) so hyperframes can access local image references
      const tmpUploads = path.join(os.tmpdir(), 'uploads');
      const projectUploads = path.join(projectDir, 'uploads');
      try {
        await fs.cp(tmpUploads, projectUploads, { recursive: true, force: true });
      } catch (err) {
        // Ignored if tmp/uploads doesn't exist yet
      }

      console.log(`Rendering in ${projectDir}`);
      // Render the video
      console.log(`Executing render...`);
      await execPromise(`npx -y hyperframes render --output out.mp4`, { cwd: projectDir });
      console.log(`Render complete!`);

      const videoPath = path.join(projectDir, "out.mp4");
      
      // Serve the file
      res.sendFile(videoPath, (err) => {
        if (err) {
          console.error("Error sending file", err);
          if (!res.headersSent) {
            res.status(500).json({ error: "Failed to send video file" });
          }
        }
        // Cleanup after sending
        fs.rm(tempDir, { recursive: true, force: true }).catch(console.error);
      });
      
    } catch (error: any) {
      console.error("Rendering failed:", error);
      res.status(500).json({ error: "Rendering failed", details: error.message });
      // Cleanup on error
      fs.rm(tempDir, { recursive: true, force: true }).catch(console.error);
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
