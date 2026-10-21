import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset URLs so dist/ works from any folder on the server, not just the domain root.
  base: './',
  plugins: [react()],
});
