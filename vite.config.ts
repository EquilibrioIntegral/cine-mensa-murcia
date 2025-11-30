import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga las variables de entorno desde .env o el sistema (Vercel)
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        // Apuntar @ a la raíz (.) en lugar de ./src porque los archivos están en la raíz
        "@": path.resolve(__dirname, "./"),
      },
    },
    define: {
      // Reemplaza process.env.API_KEY por el valor real durante la construcción
      // Si env.API_KEY no existe (dev sin .env), usa string vacío para evitar crash
      'process.env.API_KEY': JSON.stringify(env.API_KEY || ""),
      // Importante: Definir process.env vacío para compatibilidad con librerías node
      'process.env': {} 
    }
  }
})