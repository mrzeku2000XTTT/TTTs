import { loadEnv } from 'vite';
const env = loadEnv('development', '.', '');
console.log('Key:', env.GEMINI_API_KEY);
