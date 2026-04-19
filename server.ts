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
      await execPromise(`npx -y hyperframes render --output out.mp4`, { cwd: projectDir });

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
