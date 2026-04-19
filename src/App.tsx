/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-dark.css'; // Dark theme
import { Play, Loader2, PlayCircle, Download, Sparkles, ImagePlus, X, MonitorPlay, Film } from 'lucide-react';
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
      tl.from("#title", { opacity: 0, y: 100, duration: 1.5, ease: "power4.out" }, 0);
      tl.to("#title", { opacity: 0, scale: 1.2, duration: 1, ease: "power2.in" }, 3);

      // Outro Animation
      tl.from("#subtitle", { opacity: 0, x: -100, duration: 1, ease: "power4.out" }, 4.5);

      window.__timelines["main"] = tl;
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
  
  // prompt state
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  
  // Image reference state
  const [refImageBase64, setRefImageBase64] = useState<string | null>(null);
  const [refImageMime, setRefImageMime] = useState<string | null>(null);
  const [refImageUrl, setRefImageUrl] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      // Extract base64 without data prefix
      const base64Data = result.split(',')[1];
      
      setRefImageBase64(base64Data);
      setRefImageMime(file.type);
      setIsUploadingImage(true);

      try {
        const res = await fetch('/api/upload-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: base64Data, mimeType: file.type })
        });
        
        let data;
        const textResponse = await res.text();
        try {
          data = JSON.parse(textResponse);
        } catch (e) {
          throw new Error('Server returned an invalid response. If deployed on Vercel, the API wrapper is not running. Check the README for deployment details.');
        }

        if (data.url) {
          setRefImageUrl(data.url);
        } else {
          console.error("No URL returned from upload");
        }
      } catch (err) {
        console.error("Upload failed", err);
      } finally {
        setIsUploadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setRefImageBase64(null);
    setRefImageMime(null);
    setRefImageUrl(null);
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
- Audio & Sound Design: Explicitly describe the driving Soundtrack profile. Explain EXACTLY how the key visual sweeps and text hits will sync.
- Image Generation: Explicitly describe the generated imagery for the background or focus of EACH slide. Formulate realistic subjects and settings. Explain how the images will be generated via contextual placeholder URLs (e.g. 'https://picsum.photos/seed/[descriptive-keyword-here]/1920/1080') for each individual scene.
- Dictate specific, real motion mathematics and GSAP constants: exact easing curves (e.g., 'expo.inOut', 'power4.out', 'back.out(1.7)', 'elastic.out(1, 0.3)'), timeline overlap parameters (like '-=0.5', '<0.1'), and stagger amounts.
- Demand advanced visual hooks: span-wrapped typography for staggered character-by-character reveals, ultra-smooth 3D hardware transforms (rotationX, skewX, scale with transformOrigin adjustments).
- Mandate optical depth techniques: dynamic blur focus-pulls (filter: blur(20px) to 0), and sharp CSS clip-path polygon sweeps for element reveals.
- Enforce strict high-end editorial aesthetics: absolute positioning, massive bold Swiss typography, extreme high-contrast colors, and exquisite negative space.
- The output should read like a demanding Hollywood creative director dictating a precise, frame-by-frame choreography brief.`;

      const res = await fetch('/api/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemInstruction: enhanceSystemPrompt })
      });
      
      let data;
      const textResponse = await res.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error('API unreachable/failed parsing response. If you migrated to Vercel, the internal Express server is not supported natively. See README.');
      }
      
      if (!res.ok) throw new Error(data.error || data.details || "Enhance failed");

      const enhancedText = data.text || "";
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
      const systemPrompt = `You are an expert Hyperframes composition creator. Hyperframes is an HTML-to-video framework.
Rules for generating HTML:
1. Return ONLY valid raw HTML. No markdown formatting, no \`\`\`html tags.
2. The root must be exactly: <div id="root" data-composition-id="main" data-start="0" data-duration="${duration}" data-width="1920" data-height="1080">
3. Your overall video MUST be exactly ${duration} seconds.
4. Clip elements inside root must have: class="clip", data-start (in seconds), data-duration (in seconds), data-track-index.
   Example: <div id="title" class="clip" data-start="0" data-duration="5" data-track-index="0" style="position: absolute; width: 100%; height: 100%;">...</div>
5. Include a dark inline style background #080808 by default for the body.
6. You MUST load GSAP using exactly: <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
7. At the end of the <body>, you MUST include this inline script exact structure:
<script>
  window.__timelines = window.__timelines || {};
  const tl = gsap.timeline({ paused: true });
  // Add your gsap animations to 'tl' here
  window.__timelines["main"] = tl;
</script>
8. COMPOSITION TYPES & AUDIO RULES:
   - FORMAT TYPE: ${compType}. ${compType === '8-10 HTML Slides' ? "The user specifically requested an 8-10 slide presentation. You MUST divide the content into 8 to 10 distinct `<div class='clip scene-container'>` scenes. Time them sequentially over the " + duration + "-second duration." : "Create a cinematic sequence of scenes."}
   - You MUST include a soundtrack by putting an \`<audio>\` element in the root. Use one of these royalty-free URLs:
     * High Energy/Electronic: \`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3\`
     * Chill/Ambient: \`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3\`
     * Driving/Upbeat: \`https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3\`
     Set it to \`autoplay loop\`.
   - Choreograph your timeline hits (\`tl.to(...)\`) to visually pulse or transition along with the implied beat of the audio track you selected.
9. 1000X MOTION DESIGN RULES: 
   - Never use default easings. Use advanced easing curves: 'expo.out', 'expo.inOut', 'power4.out', 'back.out(1.7)', 'elastic.out(1, 0.3)'.
   - Use complex position parameters for overlapping motions: \`"-=0.5"\`, \`"<"\` (start at same time as previous), \`"<0.2"\`.
   - Leverage staggers heavily for elements (e.g. \`stagger: { amount: 0.8, from: "center", ease: "power2.out" }\`). 
   - Write custom JS in your script tag to split text into words or characters (wrapped in spans) BEFORE animating, if applicable, so you can stagger-reveal typography beautifully.
   - Use dynamic transform capabilities: \`rotationX\`, \`rotationY\`, \`skewX\`, \`scale\`. Combine them with \`transformOrigin: "50% 100%"\` for weight.
   - Employ modern tricks like animating \`clipPath: "polygon(0% 100%, 100% 100%, 100% 100%, 0% 100%)"\` to \`polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)\` for slick reveal sweeps.
   - Use \`filter: "blur(20px)"\` to \`filter: "blur(0px)"\` transitions to create optical motion depth.
10. IMAGE GENERATION RULES: 
   - If generating "8-10 HTML Slides" or any multi-scene layout, you MUST generate high-quality photography for EACH slide!
   - To do this, insert an \`<img>\` tag into each slide and use \`https://picsum.photos/seed/{custom_keyword}/1920/1080?blur=4\` as the \`src\`.
   - IMPORTANT: Replace \`{custom_keyword}\` with a highly specific, unique word reflecting that exact slide's content (e.g., \`seed/cyberpunk/1920/1080\`, \`seed/ocean/1920/1080\`, \`seed/workspace/1920/1080\`). This dynamically 'generates' distinct thematic images perfectly suited for the slide deck!
   - ALWAYS map these images into the background utilizing \`object-fit: cover\`, and animate them smoothly (like a slow pan or scale from 1.2 to 1).
11. Make the layout aesthetically similar to a modern editorial layout. Omit generic blocks. Use high contrast, Helvetica / Arial. Return only the raw HTML text string.`;

      let finalPrompt = prompt;
      const parts: any[] = [];
      
      if (refImageUrl && refImageBase64 && refImageMime) {
        finalPrompt += `\n\n[USER INSTRUCTION]: I uploaded a reference image. URL: "${refImageUrl}". You MUST feature this prominently inside the video. Render it using an <img src="${refImageUrl}" /> inside your clips. To ensure it renders flawlessly, ALWAYS firmly style the img with \`object-fit: cover; width: 100%; height: 100%; position: absolute;\` (or appropriate precise focal sizing within a stylish container block), and apply an elegant GSAP reveal to it (like a smooth scale-in or optical blur to 0 fade).`;
        parts.push(finalPrompt);
        parts.push({
          inlineData: {
            data: refImageBase64,
            mimeType: refImageMime,
          }
        });
      } else {
        parts.push(finalPrompt);
      }

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: parts, systemInstruction: systemPrompt })
      });
      
      let data;
      const textResponse = await res.text();
      try {
        data = JSON.parse(textResponse);
      } catch (e) {
        throw new Error('API unreachable. Standard Vercel exports do not execute the required intermediate Express framework. See README.');
      }
      
      if (!res.ok) throw new Error(data.error || data.details || "Generate failed");

      let html = data.text || "";
      // Clean up markdown markers if the model included them incorrectly
      html = html.replace(/^```html\s*/i, '').replace(/```\s*$/, '').trim();

      setCode(html);
      setPrompt('');
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

      if (!res.ok) {
        let errData;
        const errText = await res.text();
        try {
          errData = JSON.parse(errText);
        } catch {
          throw new Error('MP4 Rendering Error. The container API is missing. Vercel Serverless removes Chromium access. Check README.');
        }
        throw new Error(errData.error || errData.details || 'Failed to render');
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
    <div className="flex flex-col h-screen bg-[#080808] text-[#ffffff] font-['Helvetica_Neue',Helvetica,Arial,sans-serif]">
      <header className="flex items-center justify-between px-10 h-[80px] bg-[#080808] border-b border-[#222222]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-[#666666] flex items-center justify-center">
            <PlayCircle className="w-5 h-5 text-[#ffffff]" />
          </div>
          <h1 className="text-[24px] font-[900] tracking-[-1px] uppercase text-[#ffffff]">Hyperframes Studio</h1>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleRender}
            disabled={isRendering}
            className="flex items-center gap-2 px-6 py-4 bg-[#ffffff] text-[#080808] text-[12px] font-[700] uppercase tracking-[2px] border-none hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

      <main className="flex flex-1 overflow-hidden bg-[#222222] gap-[1px]">
        {/* Editor Pane */}
        <section className="flex flex-col flex-1 bg-[#121212] overflow-hidden">
          {/* AI Generation Box */}
          <div className="px-10 py-6 bg-[#080808] border-b border-[#222222] flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase tracking-[1px] text-[#666666]">Generation Prompt</span>
              
              {/* Settings Configuration */}
              <div className="flex items-center gap-4 text-[10px] uppercase tracking-[1px] text-[#888888]">
                <div className="flex items-center gap-2">
                  <label>Duration (sec):</label>
                  <input 
                    type="number" 
                    value={duration} 
                    onChange={e => setDuration(Number(e.target.value))} 
                    className="w-12 bg-[#1a1a1a] border border-[#333333] text-white px-2 py-1 outline-none text-center" 
                    min="1" 
                    max="60" 
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label>Layout Type:</label>
                  <select 
                    value={compType} 
                    onChange={e => setCompType(e.target.value)} 
                    className="bg-[#1a1a1a] border border-[#333333] text-white px-2 py-1 outline-none appearance-none cursor-pointer"
                  >
                    <option value="Cinematic Flow">Cinematic Flow</option>
                    <option value="8-10 HTML Slides">8-10 HTML Slides</option>
                    <option value="Single Scene">Single Scene</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="flex-1 flex flex-col gap-3">
                <textarea 
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder="A product intro with a dark background and sliding captions..."
                  className="bg-transparent border-l-2 border-[#ffffff] pl-5 text-[18px] leading-[1.4] font-normal text-[#cccccc] focus:outline-none resize-y min-h-[120px] max-h-[300px]"
                />
                {/* Image Attachment Preview */}
                <div className="pl-5 flex items-center gap-3">
                  <label className="cursor-pointer flex items-center gap-2 text-[#888888] hover:text-[#cccccc] transition-colors text-[10px] font-bold uppercase tracking-[1px]">
                    {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
                    <span>{isUploadingImage ? 'Uploading...' : 'Attach Reference Image'}</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleImageUpload} 
                      disabled={isUploadingImage}
                    />
                  </label>
                  {refImageUrl && !isUploadingImage && (
                    <div className="flex items-center gap-2 bg-[#222222] border border-[#444444] px-2 py-1 rounded">
                      <img src={refImageUrl} alt="Reference" className="w-6 h-6 object-cover rounded-sm" />
                      <span className="text-[10px] text-[#aaaaaa]">Attached</span>
                      <button onClick={removeImage} className="hover:text-white text-[#888888]">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleEnhancePrompt}
                  disabled={isEnhancing || isGenerating || !prompt.trim()}
                  className="px-6 py-2 bg-transparent text-[#cccccc] border border-[#666666] text-[10px] font-bold uppercase tracking-[2px] hover:bg-[#333333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                >
                  {isEnhancing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {isEnhancing ? 'Enhancing...' : 'Enhance Prompt'}
                </button>
                <button
                  onClick={handleGenerate}
                  disabled={isGenerating || isEnhancing || !prompt.trim()}
                  className="px-6 py-4 bg-[#222222] text-[#ffffff] border border-[#ffffff] text-[10px] font-bold uppercase tracking-[2px] hover:bg-[#444444] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
                >
                  {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : <PlayCircle className="w-3 h-3" />}
                  {isGenerating ? 'Generating...' : 'Generate Code'}
                </button>
              </div>
            </div>
          </div>

          <div className="px-10 py-4 bg-[#080808] border-b border-[#222222] flex items-center justify-between text-[11px] uppercase tracking-[1px] text-[#666666]">
            <span>index.html</span>
            <span>HTML + GSAP</span>
          </div>
          <div className="flex-1 overflow-auto bg-[#080808] custom-scrollbar p-6">
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
        <section className="flex flex-col flex-1 bg-[#121212] overflow-hidden">
          <div className="bg-[#080808] border-b border-[#222222] flex items-center justify-between text-[11px] uppercase tracking-[1px] font-bold">
            <div className="flex">
              <button 
                onClick={() => setPreviewTab('live')} 
                className={`flex items-center gap-2 px-8 py-5 border-b-2 transition-colors ${previewTab === 'live' ? 'text-white border-white bg-[#121212]' : 'text-[#666666] border-transparent hover:text-[#aaaaaa]'}`}
              >
                <MonitorPlay className="w-3 h-3" />
                Live HTML Preview
              </button>
              <button 
                onClick={() => setPreviewTab('mp4')} 
                className={`flex items-center gap-2 px-8 py-5 border-b-2 transition-colors ${previewTab === 'mp4' ? 'text-white border-white bg-[#121212]' : 'text-[#666666] border-transparent hover:text-[#aaaaaa]'}`}
              >
                <Film className="w-3 h-3" />
                Rendered MP4
              </button>
            </div>
            
            <div className="px-6">
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
              <div className="w-full h-full flex flex-col items-center justify-center p-10">
                {/* iFrame Container utilizing scaling trick */}
                <div style={{ containerType: 'inline-size' }} className="w-full max-w-4xl aspect-[16/9] bg-black border border-[#222222] shadow-2xl relative overflow-hidden group">
                  <iframe
                    key={iframeKey}
                    title="Live Render"
                    srcDoc={code}
                    className="absolute top-0 left-0 border-none origin-top-left"
                    style={{ width: '1920px', height: '1080px', transform: 'scale(calc(100cqi / 1920))' }}
                  />
                  <button 
                    onClick={() => setIframeKey(k => k + 1)}
                    className="absolute bottom-4 right-4 bg-black/60 hover:bg-black/90 text-white px-4 py-2 text-[10px] uppercase font-bold tracking-[1px] transition-colors border border-[#444444]"
                  >
                    Replay Animation
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

