import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// A GitHub Pages project site is served from /<repo>/, so the base has to be
// set at build time. Locally it stays at the root.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react()],
});
