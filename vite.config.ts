import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { feedMiddleware } from './server/feeds.ts'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'kekkai-feeds',
      configureServer(server) {
        server.middlewares.use(feedMiddleware)
      },
      configurePreviewServer(server) {
        server.middlewares.use(feedMiddleware)
      },
    },
  ],
})
