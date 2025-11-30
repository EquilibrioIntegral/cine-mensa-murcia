import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga las variables de entorno desde .env o el sistema (Vercel)
  // El tercer argumento '' permite cargar variables que no empiecen por VITE_
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      // Reemplaza process.env.API_KEY por el valor real durante la construcción
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      // Evita errores si se accede a otras propiedades de process.env de forma segura
      'process.env': {} 
    }
  }
})