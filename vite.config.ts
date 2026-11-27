import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { feedMiddleware } from './server/feeds.ts'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const url = env.VITE_SUPABASE_URL
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (mode === 'cloud' || url || key) {
    if (!url || !key)
      throw new Error(
        'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before deploying.',
      )
    if (!key.startsWith('sb_publishable_'))
      throw new Error(
        'Use a Supabase publishable key (sb_publishable_), never a secret or service-role key.',
      )
    if (new URL(url).protocol !== 'https:')
      throw new Error('Use your HTTPS Supabase project URL.')
  }
  return {
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
  }
})
