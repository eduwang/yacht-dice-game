// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'


export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mainPlayBoard: resolve(__dirname, 'mainPlayBoard.html'),
        mainPlayBoard3D: resolve(__dirname, 'mainPlayBoard3D.html'),
      },
    },
  },
})
