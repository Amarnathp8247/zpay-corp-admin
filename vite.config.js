import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory
  const env = loadEnv(mode, process.cwd(), '')
  
  const isProduction = mode === 'production'
  
  // Get API URL from environment
  const apiUrl = env.VITE_API_BASE_URL || 
                 (isProduction ? 'https://api.gzonic.com' : 'http://localhost:3000')
  
  console.log(`🚀 Vite Config - Mode: ${mode}`)
  console.log(`🌐 API Base URL: ${apiUrl}`)
  
  return {
    plugins: [react()],
    
    // Define global constants
    define: {
      __APP_ENV__: JSON.stringify(env.VITE_APP_ENV || mode),
    },
    
    // Resolve configuration
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
        '@components': path.resolve(__dirname, './src/components'),
        '@pages': path.resolve(__dirname, './src/pages'),
        '@utils': path.resolve(__dirname, './src/utils'),
        '@hooks': path.resolve(__dirname, './src/hooks'),
        '@api': path.resolve(__dirname, './src/api'),
      },
    },
    
    // Server configuration for development
    server: {
      port: 5173,
      host: true, // Listen on all addresses
      open: true, // Automatically open browser
      
      // Remove proxy when using live server directly
      // Your apiClient will make direct requests to https://api.gzonic.com
      
      // CORS headers for development
      cors: true, // Enable CORS for dev server
    },
    
    // Build configuration
    build: {
      outDir: 'dist',
      sourcemap: !isProduction,
      minify: isProduction ? 'terser' : false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            ui: ['axios'],
          },
        },
      },
      chunkSizeWarningLimit: 1000,
    },
    
    // Preview configuration
    preview: {
      port: 4173,
      host: true,
    },
    
    // Optimize dependencies
    optimizeDeps: {
      include: ['react', 'react-dom', 'react-router-dom'],
    },
  }
})