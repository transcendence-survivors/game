import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      host: "0.0.0.0",
      port: Number(env.PORT) || 5173,
    },
  }
})