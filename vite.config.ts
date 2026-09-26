import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const googleSiteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim() || process.env.VITE_GOOGLE_SITE_VERIFICATION?.trim() || ''

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'bikrikoro-google-site-verification',
      transformIndexHtml(html) {
        if (!googleSiteVerification) return html
        return html.replace(
          '</head>',
          `    <meta name="google-site-verification" content="${googleSiteVerification.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" />\n  </head>`,
        )
      },
    },
  ],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/app-[hash].js',
        assetFileNames: (assetInfo) => assetInfo.name?.endsWith('.css') ? 'assets/app.css' : 'assets/[name]-[hash][extname]',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
