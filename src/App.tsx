/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-dark.css'; // Dark theme
import { Play, Loader2, PlayCircle, Download, Sparkles, ImagePlus, X, MonitorPlay, Film, Pause, RotateCcw } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';

const DEFAULT_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body {
        width: 1920px;
        height: 1080px;
        overflow: hidden;
        background: #09090b;
        color: white;
        font-family: system-ui, sans-serif;
      }
      .flex-center {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 100%;
        height: 100%;
      }
      .clip {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        opacity: 0;
        visibility: hidden;
      }
    </style>
  </head>
  <body>
    <div
      id="root"
      data-composition-id="main"
      data-start="0"
      data-duration="8"
      data-width="1920"
      data-height="1080"
    >
      
      <div id="intro" class="clip flex-center" data-start="0" data-duration="4" data-track-index="0">
        <h1 id="title" style="font-size: 120px; font-weight: 800; letter-spacing: -2px;">
          Meet Hyperframes
        </h1>
      </div>

      <div id="outro" class="clip flex-center" data-start="4" data-duration="4" data-track-index="0" style="background: white; color: black;">
        <h2 id="subtitle" style="font-size: 96px; font-weight: 700;">
          HTML In. Video Out.
        </h2>
      </div>

    </div>

    <script>
      window.__timelines = window.__timelines || {};
      const tl = gsap.timeline({ paused: true });
      
      // Intro Animation
      tl.set("#intro", { opacity: 1, visibility: "visible" });
      tl.from("#title", { opacity: 0, y: 100, duration: 1.5, ease: "power4.out" }, 0);
      tl.to("#title", { opacity: 0, scale: 1.2, duration: 1, ease: "power2.in" }, 3);
      tl.to("#intro", { opacity: 0, visibility: "hidden", duration: 0.1 }, 4);

      // Outro Animation
      tl.set("#outro", { opacity: 1, visibility: "visible" }, 4);
      tl.from("#subtitle", { opacity: 0, x: -100, duration: 1, ease: "power4.out" }, 4.5);
      tl.to("#outro", { opacity: 0, visibility: "hidden", duration: 0.1 }, 8);

      window.__timelines["main"] = tl;
      if (window.location.protocol !== 'file:') {
        setTimeout(() => { tl.play(); }, 100);
      }
    </script>
  </body>
</html>`;

export default function App() {
  const [code, setCode] = useState(DEFAULT_HTML);
  const [isRendering, setIsRendering] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Settings state
  const [duration, setDuration] = useState(10);
  const [compType, setCompType] = useState('Cinematic Flow');
  const [previewTab, setPreviewTab] = useState<'live' | 'mp4'>('live');
  const [iframeKey, setIframeKey] = useState(0); // Used to force reload iframe
  const [enableTTS, setEnableTTS] = useState(false);
  const [audioVibe, setAudioVibe] = useState('');
  
  // prompt state
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // Image reference state
  const [attachments, setAttachments] = useState<{url: string, base64: string, mimeType: string, previewUrl?: string, source?: string}[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [scrapeUrlInput, setScrapeUrlInput] = useState('');
  const [isScraping, setIsScraping] = useState(false);

  // Live Preview Control State
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const requestRef = useRef<number>();
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);

  const handleScrapeWebsite = async () => {
    if (!scrapeUrlInput) return;
    setIsScraping(true);
    setError(null);
    let target = scrapeUrlInput;
    if (!target.startsWith('http')) {
      target = 'https://' + target;
    }
    
    // Auto-update prompt & layout type specifically for scraping 8-10 slides
    if (prompt.trim() === '' || prompt.includes("A cinematic product presentation video for")) {
      setPrompt(`Create a dynamic, 8-10 slide cinematic commercial for ${target}. Extract the precise brand colors, tone, and visual identity from the attached screenshots of its various pages. Break down the product into high-impact value props and design each slide meticulously!`);
    }
    setCompType('8-10 HTML Slides');

    try {
      const res = await fetch('/api/scrape-website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target })
      });
      
      if (res.status === 404) {
        throw new Error("Backend API not found (404). The Scrape feature requires the Express backend which is not available in static deployments like Vercel.");
      }

      const data = await res.json();
      if (res.status >= 400) {
        throw new Error(data.error || data.details || `Scrape failed with status ${res.status}`);
      }

      if (data.images && data.images.length > 0) {
        const withPreview = data.images.map((img: any) => ({
          ...img,
          previewUrl: `data:${img.mimeType};base64,${img.base64}`
        }));
        setAttachments(prev => [...prev, ...withPreview]);
      }
    } catch (err: any) {
      console.error("Scraping failed:", err);
      setError(err.message || "Failed to scrape website.");
    } finally {
      setIsScraping(false);
      setScrapeUrlInput('');
    }
  };

  // Dynamic iframe scaling layout constraint
  const [iframeScale, setIframeScale] = useState(1);
  const previewContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        // The container is aspect-[16/9] and sized by flexbox
        // We match scale inversely to 1920 base resolution so it draws pixel-perfectly without cutoffs
        setIframeScale(entries[0].contentRect.width / 1920);
      }
    });
    if (previewContainerRef.current) {
      observer.observe(previewContainerRef.current);
    }
    return () => observer.disconnect();
  }, [previewTab]);

  useEffect(() => {
    const updateProgress = () => {
      try {
        const win = iframeRef.current?.contentWindow as any;
        if (win && win.__timelines && win.__timelines["main"]) {
          setCurrentTime(win.__timelines["main"].time());
          setIsPlaying(!win.__timelines["main"].paused());
        }
      } catch (e) {
        // Ignore cross-origin issues
      }
      requestRef.current = requestAnimationFrame(updateProgress);
    };
    requestRef.current = requestAnimationFrame(updateProgress);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  const togglePlay = () => {
    const win = iframeRef.current?.contentWindow as any;
    if (win?.__timelines?.main) {
      const audios = win.document.querySelectorAll('audio');
      if (win.__timelines.main.paused()) {
        win.__timelines.main.play();
        audios.forEach((a: any) => a.play().catch(() => {}));
      } else {
        win.__timelines.main.pause();
        audios.forEach((a: any) => a.pause());
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setCurrentTime(val);
    const win = iframeRef.current?.contentWindow as any;
    if (win?.__timelines?.main) {
      win.__timelines.main.pause();
      win.__timelines.main.seek(val);
      const audios = win.document.querySelectorAll('audio');
      audios.forEach((a: any) => {
        a.currentTime = val;
        a.pause();
      });
    }
  };

  const resetAndPlay = () => {
    const win = iframeRef.current?.contentWindow as any;
    if (win?.__timelines?.main) {
      win.__timelines.main.seek(0);
      win.__timelines.main.play();
      const audios = win.document.querySelectorAll('audio');
      audios.forEach((a: any) => {
        a.currentTime = 0;
        a.play().catch(() => {});
      });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      setError(null);
      const result = event.target?.result as string;
      // Extract base64 without data prefix
      const base64Data = result.split(',')[1];
      
      setIsUploadingImage(true);

      // Auto-update prompt if empty
      if (prompt.trim() === '') {
        setPrompt("A high-end cinematic product presentation showcasing this reference image with elegant 3D depth, kinetic typography, and a smooth voiceover breakdown.");
      }

      try {
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Data, mimeType: file.type })
        });
        
        const textResponse = await res.text();
        let data;
        
        if (!res.ok) {
          try {
            data = JSON.parse(textResponse);
            throw new Error(data.error || data.details || `Upload failed with status ${res.status}`);
          } catch (e: any) {
            if (res.status === 413) {
              throw new Error("Image is too large. Please use a smaller image (under 10MB).");
            }
            throw new Error(`Server returned error ${res.status}: ${textResponse.slice(0, 100)}`);
          }
        }

        try {
          data = JSON.parse(textResponse);
        } catch (e) {
          throw new Error('Server returned an invalid response. If you are on a platform like Vercel, the backend is not running.');
        }

        if (data.url) {
          const previewUrl = `data:${file.type};base64,${base64Data}`;
          setAttachments(prev => [...prev, { url: data.url, base64: base64Data, mimeType: file.type, previewUrl }]);
        } else {
          throw new Error(data.error || "Upload failed: No URL returned from server.");
        }
      } catch (err: any) {
        console.error("Upload failed", err);
        setError(err.message || "Failed to upload image. Ensure the backend is running.");
      } finally {
        setIsUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleEnhancePrompt = async () => {
    if (!prompt.trim()) return;
    setIsEnhancing(true);
    setError(null);
    try {
      const enhanceSystemPrompt = `You are an expert Motion Design Art Director and GSAP Animation Master. The user will provide a simple idea for an animation. Your task is to 1000x their idea into a massively detailed, hyper-descriptive creative brief and choreography breakdown. 
    
CRITICAL INSTRUCTIONS:
- Output ONLY the expanded natural language prompt. No HTML, no code.
- Write a long, extensive brief (around 400-600 words) completely replacing the original prompt.
- Architecture: The target composition length is ${duration} seconds. Format it as a "${compType}". Break the scene down accordingly (e.g., if it's 8-10 HTML slides, describe the exact pacing for 8 to 10 sequential scenes over ${duration} seconds).
- Simulated UI Walkthrough: If the user provided a scraped website and wants a multi-slide video, you MUST explicitly dictate that the GSAP animation will simulate a real user navigating the web app! Dictate the creation of a fake SVG mouse cursor (\`<div class="cursor">\`), and describe EXACTLY how the cursor will animate across the screen (\`x\`, \`y\` coordinates), hover, and "click" (scale down) to trigger the transitions between the 8 different feature pages/slides!
           
- Image Context: If the user explicitly provided a reference image or scraped website screenshots, you MUST visually analyze the image data! Explicitly extract the primary brand colors (e.g., specific neon greens, dark navys), font styles, and vibe. Dictate that the final animation MUST use these exact extracted design tokens so it natively matches the provided brand!
- Audio & Sound Design: Explicitly describe the driving Soundtrack profile. The user requested this vibe: "${audioVibe || 'Cinematic / Upbeat'}". Explain EXACTLY how the key visual sweeps and text hits will sync to this track!
${enableTTS ? `- Voiceover (TTS): The user explicitly requested an A.I. Voiceover script. You MUST write a compelling, high-energy narrator script that perfectly matches the visuals and the duration of the video. Dictate exactly when the voiceover speaks and when it pauses.` : ''}
- Image Generation: Explicitly describe the generated imagery for the background or focus of EACH slide. Formulate realistic subjects and settings. Explain how the images will be generated using the Pollinations AI URL structure (\`https://image.pollinations.ai/prompt/{URL_ENCODED_PROMPT}?width=1920&height=1080&nologo=true\`).
- Dictate specific, real motion mathematics and GSAP constants: exact easing curves (e.g., 'expo.inOut', 'power4.out', 'back.out(1.7)', 'elastic.out(1, 0.3)'), timeline overlap parameters (like '-=0.5', '<0.1'), and stagger amounts.
- Demand advanced visual hooks: span-wrapped typography for staggered character-by-character reveals, ultra-smooth 3D hardware transforms (rotationX, skewX, scale with transformOrigin adjustments).
- Mandate optical depth techniques: dynamic blur focus-pulls (filter: blur(20px) to 0), and sharp CSS clip-path polygon sweeps for element reveals.
- Enforce strict high-end editorial aesthetics: absolute positioning, massive bold Swiss typography, extreme high-contrast colors, and exquisite negative space.

THE 4 LAYERS OF MOTION DESIGN (YOU MUST ENFORCE THESE IN YOUR BRIEF):
1. Physical Layer: Dictate precision in easing curves (cubic-bezier, expo, elastic), physics simulation, spring dynamics, inertia, and overshoot.
2. Compositional Layer: Dictate stagger timing, element hierarchy, choreography, and rhythm.
3. Narrative Layer: Dictate alignment with emotional intent, brand voice, and guiding viewer attention.
4. Technical Layer: Demand mastery of precise tool syntax (GSAP constants).

KEY TERMINOLOGY & STANDARDS TO DEMAND:
- Kinetic Typography: Dictate explosive, manual character-by-character JS Splitting text techniques. Do not treat text as solid blocks.
- Multi-Plane Depth & Parallax: Dictate animating background, mid-ground, and foreground elements simultaneously at slightly different speeds.
- Whip Pans & Hard Cuts: Demand aggressive, rapid scene transitions utilizing \`expo.inOut\` to whip between frames.
- Overshoot: Allow animations to exceed target values slightly before settling to create an elastic, organic feel.
- Stagger: Always apply sequential delays to grouped elements (e.g., \`stagger: { amount: 0.8 }\`).
- Easing Profiles: Never use default linear or ease-in-out without intention. Drive momentum with specific mathematical curves (e.g., GSAP's \`expo.out\`, \`power4.inOut\`, \`back.out(1.7)\`, \`elastic.out(1, 0.3)\`).
- Motion Blur & Depth: Simulate real-world camera exposure using dynamic CSS \`filter: blur(20px)\` fading to \`0px\`.

- The output should read like a demanding Hollywood creative director dictating a precise, frame-by-frame choreography brief using the motion physics above!`;

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');
        throw new Error(isVercel 
          ? "GEMINI_API_KEY is missing in your Vercel Environment Variables. This app requires an AI key to enhance prompts." 
          : "GEMINI_API_KEY is not defined. Ensure it is set in your environment configuration.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const parts: any[] = [{ text: prompt }];

      if (attachments.length > 0) {
        attachments.forEach((att, index) => {
          parts.push({
            inlineData: {
              data: att.base64,
              mimeType: att.mimeType,
            }
          });
        });
        parts[0].text += `\n\n[CONTEXT]: Examine the attached reference images or scraped website pages. Extract the brand colors, typography style, and mood to incorporate directly into the art direction brief! If directing a walkthrough, explicitly dictate the sequence using the provided images numbering (Image 1, Image 2, etc.).`;
      }

      const model = ai.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        systemInstruction: enhanceSystemPrompt 
      });

      const result = await model.generateContent(parts);
      const response = await result.response;
      const enhancedText = response.text() || "";
      setPrompt(enhancedText.trim());
    } catch (err: any) {
      console.error(err);
      setError("Failed to enhance prompt: " + err.message);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      let isUsingScrapedImages = attachments.length > 0;
      
      const isVercel = typeof window !== 'undefined' && window.location.hostname.includes('vercel.app');

      const systemPrompt = `You are an expert Hyperframes composition creator. Hyperframes is an HTML-to-video framework.
Rules for generating HTML:
1. Return ONLY valid raw HTML. No markdown formatting, no \`\`\`html tags.
2. The root must be exactly: <div id="root" data-composition-id="main" data-start="0" data-duration="${duration}" data-width="1920" data-height="1080">
3. Your overall video MUST be exactly ${duration} seconds.
4. Clip elements inside root must have: class="clip", data-start (in seconds), data-duration (in seconds), data-track-index.
   Example: <div id="title" class="clip" data-start="0" data-duration="5" data-track-index="0" style="position: absolute; width: 100%; height: 100%;">...</div>
5. Include a dark inline style background #080808 by default for the body.
   - STACKING & VISIBILITY: You MUST include this CSS block: \`.clip { position: absolute; top: 0; left: 0; width: 100%; height: 100%; overflow: hidden; opacity: 0; visibility: hidden; }\`. 
   - In your GSAP timeline, you MUST orchestrate the entry and exit of every clip: \`tl.to("#clipId", { opacity: 1, visibility: "visible", duration: 0.1 }, startTime)\` and \`tl.to("#clipId", { opacity: 0, visibility: "hidden", duration: 0.1 }, endTime)\`. This prevents overlapping UI from different scenes.
6. You MUST load GSAP using exactly: <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
7. At the end of the <body>, you MUST include this inline script exact structure:
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  
  // Helper for TTS Loading
  function loadTTS(text, voice = "Brian") {
    const audio = new Audio("https://api.streamelements.com/kappa/v2/speech?voice=" + voice + "&text=" + encodeURIComponent(text));
    document.body.appendChild(audio);
    return audio;
  }

  // Add your gsap animations to 'tl' here
  
  window.__timelines["main"] = tl;
  window.__hf = { duration: ${duration}, seek: (t) => { tl.seek(t); } };
  if (window.location.protocol !== 'file:') {
    setTimeout(() => { 
      tl.play(); 
      document.querySelectorAll('audio').forEach(a => a.play().catch(()=>{}));
    }, 100);
  }
</script>
8. COMPOSITION TYPES & AUDIO RULES:
   - FORMAT TYPE: ${compType}. ${compType === '8-10 HTML Slides' ? "The user specifically requested an 8-10 slide presentation. You MUST divide the content into 8 to 10 distinct `<div class='clip scene-container'>` scenes. Time them sequentially over the " + duration + "-second duration. If you are simulating a website or product walkthrough, CREATE a fake SVG mouse cursor (`<div id='cursor'>`), animate its `x` and `y` properties with GSAP, simulate hover states, and use a scale down/up bounce to simulate 'clicks' transitioning between slides!" : "Create a cinematic sequence of scenes."}
   - USER AUDIO VIBE: The user requested the following audio vibe: "${audioVibe || 'High Energy / Electronic'}".
   - You MUST include a soundtrack by putting an \`<audio>\` element in the root. Based on the requested vibe, pick the most appropriate royalty-free URL (or find another standard one):
     * High Energy/Electronic: \`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3\`
     * Chill/Ambient: \`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3\`
     * Driving/Upbeat: \`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3\`
     Set it to \`autoplay loop\`.
   - Choreograph your timeline hits (\`tl.to(...)\`) to visually pulse or transition along with the implied beat of the audio track you selected.
${enableTTS ? `   - VOICEOVER TTS: The user enabled AI voiceover! You MUST write a compelling narrator script. 
     * IMPORTANT: Call the \`loadTTS(script)\` helper function inside your script tag!
     * Example: \`const vo = loadTTS("Welcome to the cinematic experience."); tl.add(() => vo.play(), 0.5);\`` : ''}
9. 1000X MOTION DESIGN RULES: 
   - KINETIC TYPOGRAPHY IS MANDATORY: You MUST write custom JS inside your script tag to split heading strings into individual \`<span>\` characters BEFORE animating. Example: \`const text = document.querySelector("#title"); text.innerHTML = text.textContent.split("").map(c => "<span style='display:inline-block; opacity:0;'>" + (c===" " ? "&nbsp;" : c) + "</span>").join(""); tl.fromTo("#title span", {opacity:0, y:50, rotationX:-90}, {opacity:1, y:0, rotationX:0, stagger:0.02, ease:"back.out(1.7)", duration:0.8})\`.
   - PARALLAX & MULTI-PLANE: Abstract your scenes into Foreground, Midground, and Background layers. Shift them on the Z-axis or animate their Y-axis at staggeringly different speeds (e.g. background moves -50px, foreground moves -150px) to simulate massive 3D camera depth!
   - KINEMATICS & EASINGS: NEVER use default easings. Use \`expo.out\`, \`power4.inOut\`, \`back.out(1.7)\`, or \`elastic.out(1, 0.3)\`. Demand overshoot!
   - OVERLAPPING CHOREOGRAPHY: Use complex position parameters like \`"-=0.5"\`, \`"<"\`, \`"<0.2"\` so elements flow organically into one another instead of waiting rigidly.
   - OPTICAL FOCUS PULLS: Animate CSS \`filter: blur(20px)\` to \`blur(0px)\` to simulate a camera lens hunting for focus.
   - SLICK REVEALS: Animate \`clipPath: polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)\` to \`polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)\`.
   - EXPERT PHYSICS: Always append \`force3D: true\` to your tweens to trigger GPU hardware acceleration! Combine transforms like \`rotationX\`, \`rotationY\`, \`scale\`, and \`transformOrigin: "50% 100%"\` to give elements physical weight!
   - CINEMATIC TEXTURE: Inject a CSS pseudo-element overlay covering the body with subtle animated visual grain/noise and a vignette to make the pure HTML feel like a real camera lens!
10. IMAGE & CAMERA MOVEMENT RULES:
${
  attachments.length === 1 
  ? `   - ⚡ SINGLE IMAGE FOCUS: The user provided exactly ONE high-quality reference image. You MUST make this image the heart of a powerful, single-scene Cinematic Flow. Animate it with a massive, slow, continuous "Gliding Camera" move (scale from 1.2 to 1 and slight pan) across the full ${duration} seconds. Layer multiple kinetic text reveals over it to tell the story.`
  : isUsingScrapedImages 
  ? `   - IMPORTANT: The user has attached actual screenshot images of a website to use. DO NOT generate fake images with Pollinations AI. Instead, use ONLY the exact image URLs provided in the user prompt! Map them cleanly using \`<img src="..." style="width: 100%; height: 100%; object-fit: cover;" />\` into your scenes.
    - ⚡ CRITICAL CAMERA REQUIREMENT: You MUST animate every single image continuously across the complete duration of its parent scene to simulate a cinematic camera move (Ken Burns style)! Example: \`tl.fromTo("#img1", { scale: 1.15, y: 50 }, { scale: 1, y: -50, duration: 4, ease: "none" },...)\` It should glide constantly, DO NOT let it sit still.`
  : `   - If generating "8-10 HTML Slides" or any multi-scene layout, you MUST generate high-quality photography for EACH slide!
    - To do this, insert an \`<img>\` tag into each slide. You MUST use the free Pollinations AI image generator API by setting the \`src\` exactly matching this pattern: \`https://image.pollinations.ai/prompt/{detailed_visual_description_URL_encoded}?width=1920&height=1080&nologo=true\`
    - IMPORTANT: Replace \`{detailed_visual_description_URL_encoded}\` with a highly specific, unique, URL-encoded prompt reflecting that exact slide's content (e.g., \`a%20sleek%20cyberpunk%20terminal%20glowing%20in%20a%20dark%20room\`). This dynamically 'generates' a brand new, explicit AI image perfectly suited for that slide!
    - ⚡ CRITICAL CAMERA REQUIREMENT: ALWAYS animate these background images to simulate a sweeping cinematic camera! Apply a massive, slow, continuous GSAP tween spanning the entire duration of the clip (e.g., pan on the Y axis, or slow scale from 1.2 to 1 over the full duration utilizing \`ease: "none"\` or \`ease: "sine.inOut"\`). Do not let images sit static.`
}
11. Make the layout aesthetically similar to a modern editorial layout. Omit generic blocks. Use high contrast, Helvetica / Arial. Return only the raw HTML text string.`;

      let finalPrompt = prompt;
      const parts: any[] = [];
      
      if (attachments.length > 0) {
        finalPrompt += `\n\n[USER INSTRUCTION]: I uploaded ${attachments.length} reference images. You MUST feature them prominently inside the video. Render them using \`<img src="..." />\` inside your clips. To ensure they are FULLY visible and not aggressively cropped or zoomed-in, ALWAYS style the imgs with \`object-fit: cover; width: 100%; height: 100%; position: absolute;\` (or elegantly frame them inside a stylized container floating in the scene). 
⚡ CRITICAL: You MUST apply a continuous "Gliding Camera" GSAP animation to EVERY image! Use \`tl.fromTo(..., { scale: 1.15, y: 50 }, { scale: 1, y: -50, duration: clipDuration, ease: "none" }, ...)\` to make sure the images are constantly moving and panning across the screen. DO NOT leave them statically sitting there!`;
        
        let urls = attachments.map((a, index) => {
            let fullUrl = a.url;
            if (fullUrl.startsWith('/')) {
              fullUrl = window.location.origin + fullUrl;
            }
            return `Image ${index + 1}: ${fullUrl}`;
        }).join('\n');
        
        finalPrompt += `\n\nThe image URLs to use in your GSAP code are:\n${urls}\nMake sure to use the exact matching URL when referring to a specific Image #.`;
        
        parts.push({ text: finalPrompt });
        attachments.forEach(att => {
            parts.push({
              inlineData: {
                data: att.base64,
                mimeType: att.mimeType,
              }
            });
        });
      } else {
        parts.push({ text: finalPrompt });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error(isVercel 
          ? "GEMINI_API_KEY is missing in your Vercel Environment Variables. This app requires an AI key to generate layouts." 
          : "GEMINI_API_KEY is not defined. Ensure it is set in your environment configuration.");
      }
      const ai = new GoogleGenAI({ apiKey });
      const model = ai.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
        systemInstruction: systemPrompt 
      });

      const response = await model.generateContent(parts);
      const result = await response.response;
      let html = result.text() || "";
      // Smart extraction to grab just the HTML code if the model wrapped it in markdown
      const match = html.match(/```(?:html)?\s*([\s\S]*?)```/);
      if (match) {
        html = match[1];
      }
      html = html.trim();

      setCode(html);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRender = async () => {
    setIsRendering(true);
    setError(null);
    setVideoUrl(null);
    try {
      const res = await fetch('/api/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html: code }),
      });

      if (res.status === 404) {
        throw new Error("Backend API not found (404). This feature requires the 'server.ts' backend which is not available in static deployments like Vercel. Try running locally or on a platform with persistent Node.js support.");
      }

      if (!res.ok) {
        let errData;
        const errText = await res.text();
        try {
          errData = JSON.parse(errText);
        } catch {
          throw new Error('MP4 Rendering Error: Server returned an invalid response (not JSON). The Render pipeline might have crashed or timed out.');
        }
        
        let displayError = errData.error || 'Failed to render';
        if (errData.details && errData.details.includes('window.__hf not ready')) {
          displayError = "Render failed: The LLM generated an invalid layout. It must include the window.__timelines['main'] injection to sync. Try generating the code again!";
        } else if (errData.details) {
          displayError += ': ' + errData.details;
        }

        throw new Error(displayError);
      }

      const rawBlob = await res.blob();
      // Force the correct MIME type so the browser video player recognizes it
      const blob = new Blob([rawBlob], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsRendering(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#080808] text-[#ffffff] font-['Space_Grotesk',system-ui,sans-serif]">
      <header className="flex flex-col sm:flex-row items-center justify-between px-6 sm:px-10 py-4 sm:h-[80px] bg-[#080808] border-b border-[#222222] gap-4 sm:gap-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-[#555] flex items-center justify-center rounded-sm bg-[#111]">
            <PlayCircle className="w-5 h-5 text-[#fff]" />
          </div>
          <h1 className="text-[20px] sm:text-[24px] font-[700] tracking-tight text-[#ffffff]">Hyperframes Studio</h1>
        </div>
        <div className="flex items-center w-full sm:w-auto">
          <button
            onClick={handleRender}
            disabled={isRendering}
            className="flex items-center justify-center w-full sm:w-auto gap-2 px-6 py-3 sm:py-4 bg-[#ffffff] text-[#080808] text-[12px] font-[700] uppercase tracking-wide rounded-sm hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRendering ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4 fill-current" />
            )}
            {isRendering ? 'Rendering Frame-by-Frame...' : 'Render to MP4'}
          </button>
        </div>
      </header>

      <main className="flex flex-col lg:flex-row flex-1 overflow-hidden bg-[#222222] gap-[1px]">
        {/* Editor Pane */}
        <section className="flex flex-col flex-1 lg:w-1/2 bg-[#0c0c0c] overflow-y-auto lg:overflow-hidden">
          {/* AI Generation Box */}
          <div className="px-6 py-6 sm:px-10 sm:py-8 bg-[#0a0a0a] border-b border-[#222222] flex flex-col gap-6">
            {error && (
              <div className="bg-[#1a0c0c] border-l-2 border-[#ff4444] p-4 mb-2 flex items-start gap-3 group">
                <div className="text-[#ff4444] mt-0.5"><X className="w-4 h-4" /></div>
                <div className="flex-1">
                  <p className="text-[12px] font-bold text-[#ff4444] uppercase tracking-wider mb-1">System Error</p>
                  <p className="text-[13px] text-[#ccc] leading-relaxed">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="text-[#666] hover:text-[#fff] transition-colors"><X className="w-4 h-4" /></button>
              </div>
            )}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-[12px] font-medium tracking-wide text-[#888888]">Scene Generator</span>
              
              {/* Settings Configuration */}
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-[11px] font-medium tracking-wide text-[#777]">
                <div className="flex items-center gap-2 bg-[#141414] border border-[#222] px-3 py-1.5 rounded-sm">
                  <label className="text-[#999]">Duration (s)</label>
                  <input 
                    type="number" 
                    value={duration} 
                    onChange={e => setDuration(Number(e.target.value))} 
                    className="w-10 bg-transparent text-white outline-none text-center font-mono" 
                    min="1" 
                    max="60" 
                  />
                </div>
                <div className="flex items-center gap-2 bg-[#141414] border border-[#222] px-3 py-1.5 rounded-sm">
                  <label className="text-[#999]">Layout</label>
                  <select 
                    value={compType} 
                    onChange={e => setCompType(e.target.value)} 
                    className="bg-transparent text-white outline-none appearance-none cursor-pointer"
                  >
                    <option value="Cinematic Flow">Cinematic Flow</option>
                    <option value="8-10 HTML Slides">8-10 HTML Slides</option>
                    <option value="Single Scene">Single Scene</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-[#141414] border border-[#222] px-3 py-1.5 rounded-sm">
                  <label className="text-[#999] cursor-pointer flex items-center gap-1.5">
                    <input 
                      type="checkbox" 
                      checked={enableTTS} 
                      onChange={e => setEnableTTS(e.target.checked)} 
                      className="accent-white" 
                    />
                    A.I. Voiceover (TTS)
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="w-full flex-col gap-3">
                <textarea 
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="Describe your motion concept... e.g. A dark, cinematic product intro with sliding captions..."
                  className="w-full bg-transparent border-l-2 border-[#444] hover:border-[#888] focus:border-[#fff] pl-4 text-[16px] sm:text-[18px] leading-relaxed font-normal text-[#eee] focus:outline-none resize-y min-h-[100px] sm:min-h-[120px] transition-colors"
                />
                <div className="mt-3 mb-2 flex items-center border-l-2 border-[#333] pl-4">
                  <input 
                    type="text" 
                    value={audioVibe}
                    onChange={e => setAudioVibe(e.target.value)}
                    placeholder="Audio Vibe: e.g. Cyberpunk synthwave, calm corporate piano, aggressive trap beat..."
                    className="w-full bg-transparent text-[13px] text-[#aaa] placeholder-[#555] focus:outline-none focus:text-[#fff]"
                  />
                </div>
                {/* Image Attachment Preview */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer flex items-center gap-2 text-[#888888] hover:text-[#cccccc] transition-colors text-[11px] font-medium uppercase tracking-wide bg-[#1a1a1a] border border-[#333] px-3 py-2 rounded-sm hover:bg-[#222]">
                    {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    <span>{isUploadingImage ? 'Uploading...' : 'Attach Image'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload} 
                      disabled={isUploadingImage}
                    />
                  </label>
                  
                  <div className="flex items-center gap-2 bg-[#1a1a1a] border border-[#333] px-3 py-1 rounded-sm focus-within:border-[#555] transition-colors">
                    <input 
                      type="text" 
                      value={scrapeUrlInput}
                      onChange={e => setScrapeUrlInput(e.target.value)}
                      placeholder="Or extract from URL..."
                      className="bg-transparent text-[11px] outline-none text-[#cccccc] placeholder-[#666] w-40"
                      onKeyDown={e => e.key === 'Enter' && handleScrapeWebsite()}
                    />
                    <button 
                      onClick={handleScrapeWebsite}
                      disabled={isScraping || !scrapeUrlInput.trim()}
                      className="text-[10px] font-bold uppercase text-[#888] hover:text-[#fff] disabled:opacity-50 transition-colors"
                    >
                      {isScraping ? 'Scraping...' : 'Scrape'}
                    </button>
                  </div>

                  {attachments.map((att, index) => (
                    <div key={index} className="flex items-center gap-3 bg-[#141414] border border-[#333] p-1.5 pr-4 rounded-sm shadow-lg group hover:border-[#555] transition-colors relative">
                      <div className="relative w-10 h-10 overflow-hidden rounded-sm border border-[#222]">
                        <img src={att.previewUrl || att.url} alt={`Reference ${index}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-[#eee] uppercase tracking-wider">Ref {index + 1}</span>
                        <span className="text-[9px] text-[#666] font-mono uppercase">{att.mimeType.split('/')[1]}</span>
                      </div>
                      <button 
                        onClick={() => removeImage(index)} 
                        className="ml-2 p-1.5 bg-[#222] hover:bg-[#ff4444] rounded-sm text-[#888] hover:text-white transition-all transform hover:rotate-90"
                        title="Remove Image"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-start gap-3 border-t border-[#222] pt-6 mt-2">
                <button
                  onClick={handleEnhancePrompt}
                  disabled={isEnhancing || isGenerating || !prompt.trim()}
                  className="px-6 py-2.5 bg-transparent text-[#cccccc] border border-[#555] rounded-sm text-[11px] font-bold uppercase tracking-wide hover:bg-[#222] hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isEnhancing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || isEnhancing || !prompt.trim()}
                  className="px-8 py-2.5 bg-[#ffffff] text-[#000] rounded-sm text-[11px] font-bold uppercase tracking-wide hover:bg-[#e0e0e0] shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PlayCircle className="w-3.5 h-3.5" />}
                  {isGenerating ? 'Generating...' : 'Generate Code'}
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 sm:px-10 py-3 bg-[#0a0a0a] border-b border-[#222222] flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-[#666666]">
            <span>index.html</span>
            <span className="bg-[#1a1a1a] px-2 py-0.5 rounded-sm border border-[#333]">HTML + GSAP</span>
          </div>
          <div className="flex-1 overflow-auto bg-[#0a0a0a] custom-scrollbar p-6">
            <Editor
              value={code}
              onValueChange={code => setCode(code)}
              highlight={code => Prism.highlight(code, Prism.languages.html, 'html')}
              padding={10}
              style={{
                fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                fontSize: 14,
                minHeight: '100%',
              }}
              textareaClassName="focus:outline-none"
            />
          </div>
        </section>

        {/* Output Pane */}
        <section className="flex flex-col flex-1 lg:w-1/2 bg-[#000] overflow-hidden border-t sm:border-t-0 sm:border-l border-[#222]">
          <div className="bg-[#0a0a0a] border-b border-[#222222] flex items-center justify-between text-[11px] font-medium uppercase tracking-wide">
            <div className="flex overflow-x-auto custom-scrollbar-hidden">
              <button 
                onClick={() => setPreviewTab('live')} 
                className={`flex items-center whitespace-nowrap gap-2 px-6 sm:px-8 py-4 border-b-[3px] transition-colors ${previewTab === 'live' ? 'text-white border-white bg-[#111]' : 'text-[#666666] border-transparent hover:text-[#aaaaaa] hover:bg-[#111]'}`}
              >
                <MonitorPlay className="w-4 h-4" />
                Live Preview
              </button>
              <button 
                onClick={() => setPreviewTab('mp4')} 
                className={`flex items-center whitespace-nowrap gap-2 px-6 sm:px-8 py-4 border-b-[3px] transition-colors ${previewTab === 'mp4' ? 'text-white border-white bg-[#111]' : 'text-[#666666] border-transparent hover:text-[#aaaaaa] hover:bg-[#111]'}`}
              >
                <Film className="w-4 h-4" />
                MP4 Output
              </button>
            </div>
            
            <div className="px-4 sm:px-6">
              {previewTab === 'mp4' && videoUrl && (
                <a href={videoUrl} download={`hyperframes-${duration}s.mp4`} className="text-[#ffffff] hover:text-[#cccccc] flex items-center gap-2 transition-colors">
                  <Download className="w-4 h-4" />
                  <span className="hidden sm:inline">Export MP4</span>
                </a>
              )}
            </div>
          </div>
          <div className="flex-1 flex flex-col overflow-hidden bg-[#000000] relative">
            {previewTab === 'live' ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 sm:p-10">
                {/* iFrame Container utilizing JS-driven ResizeObserver scaling trick */}
                <div ref={previewContainerRef} className="w-full max-w-5xl aspect-[16/9] bg-black border border-[#222222] shadow-2xl relative overflow-hidden group z-0">
                  <iframe
                    ref={iframeRef}
                    key={iframeKey}
                    title="Live Render"
                    srcDoc={code}
                    className="absolute top-0 left-0 border-none origin-top-left"
                    style={{ width: '1920px', height: '1080px', transform: `scale(${iframeScale})` }}
                  />
                </div>
                {/* Custom Playback Controls */}
                <div className="w-full max-w-5xl mt-4 bg-[#0a0a0a] border border-[#222] rounded-sm p-3 flex items-center gap-4 relative z-10">
                  <button onClick={togglePlay} className="text-[#eee] hover:text-[#fff] transition-colors p-1 min-w-[24px] flex justify-center">
                    {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                  </button>
                  
                  <button onClick={resetAndPlay} className="text-[#888] hover:text-[#fff] transition-colors p-1" title="Rewind to Start">
                    <RotateCcw className="w-4 h-4" />
                  </button>

                  <div className="flex-1 flex items-center gap-3">
                    <span className="text-[10px] font-mono text-[#666] w-8 text-right">{currentTime.toFixed(1)}s</span>
                    <input 
                      type="range"
                      min="0"
                      max={duration}
                      step="0.01"
                      value={currentTime}
                      onChange={handleSeek}
                      className="flex-1 h-1.5 bg-[#333] rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-[#666] w-8">{duration.toFixed(1)}s</span>
                  </div>

                  <button 
                    onClick={() => setIframeKey(k => k + 1)}
                    className="text-[#888] hover:text-[#fff] transition-colors p-1 text-[10px] uppercase font-bold flex items-center gap-2 border-l border-[#333] pl-4"
                    title="Full iFrame Reload"
                  >
                    Reload Frame
                  </button>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-10">
                {error ? (
                  <div className="max-w-md p-8 bg-[#080808] border border-[#222222]">
                    <h3 className="text-[11px] uppercase tracking-[1px] text-[#666666] flex items-center gap-2 mb-4">
                      <span className="text-[#ffffff]">⚠</span> Rendering Error
                    </h3>
                    <pre className="text-[14px] leading-relaxed font-normal text-[#cccccc] border-l-2 border-[#ffffff] pl-5 mt-2 whitespace-pre-wrap font-sans">{error}</pre>
                  </div>
                ) : videoUrl ? (
                  <div className="w-full max-w-3xl aspect-[16/9] bg-[linear-gradient(45deg,#111,#1a1a1a)] border border-[#222222] flex items-center justify-center relative">
                    <video
                      src={videoUrl}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                    />
                  </div>
                ) : isRendering ? (
                  <div className="flex flex-col items-center gap-6 text-[#666666]">
                    <div className="w-16 h-16 rounded-full border border-[#222222] border-t-[#ffffff] animate-spin"></div>
                    <div className="text-[11px] uppercase tracking-[2px] text-[#ffffff] animate-pulse">Launching Headless Chrome</div>
                    <p className="text-[14px] font-normal text-[#cccccc] border-l-2 border-[#ffffff] pl-5 max-w-sm">
                      Hyperframes is loading your HTML, scrubbing the GSAP timeline frame-by-frame, and generating MP4.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6 text-[#666666]">
                    <div className="w-20 h-20 bg-[#121212] border border-[#222222] flex items-center justify-center">
                      <Film className="w-8 h-8 opacity-50" />
                    </div>
                    <p className="text-[11px] uppercase tracking-[2px] max-w-xs text-center mt-2">
                      Ready to Render MP4 Engine
                    </p>
                    <p className="text-[10px] text-[#444444] text-center max-w-[200px]">
                      Switch to "Live HTML Preview" to see animations instantly in browser.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #080808;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #222222;
          border-radius: 0px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #666666;
        }
        
        /* Prism overrides for Editorial Dark Theme */
        code[class*="language-"], pre[class*="language-"] {
          color: #ffffff !important;
          text-shadow: none !important;
        }
        .token.comment, .token.prolog, .token.doctype, .token.cdata {
          color: #666666 !important;
        }
        .token.punctuation {
          color: #cccccc !important;
        }
        .token.namespace {
          opacity: .7 !important;
        }
        .token.property, .token.tag, .token.boolean, .token.number, .token.constant, .token.symbol, .token.deleted {
          color: #ffffff !important;
          font-weight: 700 !important;
        }
        .token.selector, .token.attr-name, .token.string, .token.char, .token.builtin, .token.inserted {
          color: #aaaaaa !important;
        }
        .token.operator, .token.entity, .token.url, .language-css .token.string, .style .token.string {
          color: #ffffff !important;
        }
        .token.atrule, .token.attr-value, .token.keyword {
          color: #ffffff !important;
          font-style: italic !important;
        }
      `}</style>
    </div>
  );
}

