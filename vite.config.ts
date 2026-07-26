import { defineConfig } from 'vite'
import path from 'path'
import fs from 'fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const certPath = path.resolve(__dirname, 'certs/localhost-cert.pem')
const keyPath = path.resolve(__dirname, 'certs/localhost-key.pem')
const hasHttpsCerts = fs.existsSync(certPath) && fs.existsSync(keyPath)
const useHttps = process.env.VITE_DEV_HTTPS === 'true' && hasHttpsCerts

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: 'localhost',
    port: 5173,
    ...(useHttps
      ? {
          https: {
            cert: fs.readFileSync(certPath),
            key: fs.readFileSync(keyPath),
          },
        }
      : {}),
  },

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('firebase')) {
              return 'firebase'
            }
            if (id.includes('radix')) {
              return 'radix'
            }
            if (id.includes('motion') || id.includes('framer-motion') || id.includes('canvas-confetti')) {
              return 'motion'
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'charts'
            }
            if (id.includes('lucide-react')) {
              return 'icons'
            }
            if (id.includes('jspdf')) {
              return 'jspdf'
            }
            if (id.includes('html2canvas')) {
              return 'html2canvas'
            }
            if (id.includes('dompurify') || id.includes('purify')) {
              return 'dompurify'
            }
            if (id.includes('@mediapipe')) {
              return 'mediapipe'
            }
            if (id.includes('date-fns') || id.includes('react-day-picker')) {
              return 'date-utils'
            }
            return 'vendor'
          }
        },
      },
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
