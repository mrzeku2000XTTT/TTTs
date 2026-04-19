# Hyperframes Motion Studio

An AI-powered HTML-to-Video generation platform leveraging GSAP for motion design and Google's Gemini Flash for rapid composition choreography.

## How It Works
This application allows you to write natural language prompts (or structural concepts) and automatically expands them into highly-detailed motion descriptions. It then generates sophisticated HTML and GSAP (GreenSock) timelines representing your prompt. By selecting "Render to MP4", the built-in [Hyperframes](https://hyperframes.heygen.com/) engine launches a headless Chromium instance to scrub your timeline frame-by-frame and exports a pristine 60FPS MP4 file natively on the backend.

### Project Architecture
This is a Full-Stack application comprising a React + Vite frontend and an Express Node.js backend.
- **Frontend (`src/App.tsx`)**: Handles the live browser preview layout using a responsive iframe trick, image referencing, and GSAP timeline isolation.
- **Backend (`server.ts`)**: Serves the Vite app locally, routes calls to the `@google/genai` API securely, and strictly handles file uploads, temporary directories, and the massive Chromium-based MP4 generation via shell commands.

## Deploying Considerations

### ⚠️ Why standard Vercel deployments fail to function
If you attempt to import this repository directly into Vercel via the standard static or serverless configuration, **your buttons (Enhance, Generate, Render) will stop working**.

Here is why:
1. **Serverless Limits**: Vercel by default statically exports the Vite frontend, meaning the `server.ts` Express backend is entirely bypassed. This causes the `/api/*` endpoints to return 404 Not Found errors.
2. **Headless Chrome Dependency**: The `hyperframes` engine requires downloading and executing headless Chromium binaries on the operating system to successfully scrub your GSAP timelines. Vercel Serverless Functions have a strict size limit (usually ~50MB) and very short execution timeouts (10 to 60 seconds) that structurally prevent the rendering engine from running correctly. Also, their serverless environments do not contain the prerequisite Linux `.so` shared libraries required by browser engines.

### How to host this correctly (Google Cloud Run / Docker)
Because this application is a computationally heavy pipeline involving OS-level file manipulation (for staging `index.html` buffers) and executing browser engines, **it MUST be hosted via a Docker container.**

If you are using Google AI Studio's built-in platform, deploying via the "Publish" or "Share" button works beautifully because it natively deploys the application as a scalable Cloud Run container instance complete with the full Express configuration and Node.js environment.

If manually hosting: use platforms like **Google Cloud Run**, **Railway**, **Render**, or **Heroku** which natively support isolated container/server processes. Ensure you supply the `GEMINI_API_KEY` system environment variable in your production host.

## Running Locally

1. Create a `.env` file at the root:
```env
GEMINI_API_KEY="your-gemini-key"
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm run dev
```

The Express server will automatically serve the Vite frontend on `http://localhost:3000`.
