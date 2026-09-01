import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Semasa `npm run dev`, hala panggilan /api ke backend Express tempatan.
    // Tidak berkesan dalam production - Express menghidangkan build ini terus.
    proxy: {
      '/api': {
        target: 'http://localhost:3070',
        changeOrigin: true,
      },
    },
  },
})
