import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    server: {
      host: "0.0.0.0",
      port: Number(env.PORT) || 5173,
    },
    resolve: {
      // Le schéma Colyseus (GameState/Player) est décoré dans le paquet
      // shared-package, mais décodé par le SDK client. Sans déduplication, Vite
      // charge deux copies physiques de @colyseus/schema (celle de shared et
      // celle du SDK) : le registre de types diffère et le décodage échoue
      // ("refId not found"). On force une instance unique.
      dedupe: ['@colyseus/schema'],
    },
  }
})