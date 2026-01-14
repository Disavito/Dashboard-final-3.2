import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { visualizer } from 'rollup-plugin-visualizer';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Agrega el visualizador. Se ejecutará solo al hacer 'npm run build'
    visualizer({
      filename: 'stats.html', // Nombre del archivo de reporte
      open: true, // Abrir el reporte en el navegador automáticamente
      gzipSize: false,
      brotliSize: false,
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'react': path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
    },
  },
  build: {
    // Aumenta el límite de advertencia para el tamaño del chunk a 1000 kB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Estrategia de división de código manual para optimizar los chunks
        manualChunks(id) {
          // Agrupa las librerías de generación de PDF en un chunk separado
          if (id.includes('jspdf') || id.includes('html2canvas')) {
            return 'pdf-libs';
          }
          // Agrupa la librería de gráficos en su propio chunk
          if (id.includes('recharts')) {
            return 'chart-libs';
          }
          // Agrupa el resto de las dependencias de node_modules en un chunk 'vendor'
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        },
      },
    },
  },
  preview: {
    host: true,
    allowedHosts: ['dashboard3-dashboard3.mv7mvl.easypanel.host']
  }
});
