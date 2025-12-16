// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  root: './',
  build: {
    rollupOptions: {
      input: '/src/main.jsx', // <-- correct entry point
    },
  },
})
