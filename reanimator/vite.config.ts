import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Ports per docs/STACK.md: UI on 5173, backend on 7070 (never Poltergeist's 4000/6660/6661).
// base './' lets the replay build (R11) be hosted under any sub-path (GitHub Pages: /<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:7070' },
  },
});
