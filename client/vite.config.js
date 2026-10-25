import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import fs from 'node:fs';
import path from 'node:path';

const api = `http://localhost:${process.env.API_PORT || 4000}`;

function spaFallbackPlugin() {
  return {
    name: 'spa-fallback',
    closeBundle() {
      try {
        const dist = path.resolve(import.meta.dirname, 'dist');
        const indexHtml = path.join(dist, 'index.html');
        if (!fs.existsSync(indexHtml)) return;
        const routes = [
          '404.html',
          'setup.html',
          'login.html',
          'courses.html',
          'students.html',
          'sandbox.html',
          'settings.html',
          'skills.html',
          'requests.html',
          'payments.html',
          'questions.html',
          'my-questions.html',
        ];
        for (const file of routes) {
          fs.copyFileSync(indexHtml, path.join(dist, file));
        }
      } catch {}
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), spaFallbackPlugin()],
  server: {
    port: Number(process.env.PORT) || 5173,
    proxy: {
      '/api': api,
      '/uploads': api,
    },
  },
});
