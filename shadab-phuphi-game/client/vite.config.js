import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `npm run dev` serves the app on http://localhost:5173
// (--host also exposes it on your Wi-Fi so phones can open it for testing).
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
