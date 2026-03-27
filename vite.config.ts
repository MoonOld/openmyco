import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Only load Electron plugin in electron mode
  const isElectron = mode === 'electron'

  return {
    plugins: [
      react(),
      ...(isElectron
        ? [
            electron([
              {
                // Main process file
                entry: 'electron/main.js',
                onstart({ startup }) {
                  // Start Electron app after Vite dev server is ready
                  startup()
                },
                vite: {
                  build: {
                    outDir: 'dist-electron',
                    rollupOptions: {
                      external: ['electron'],
                    },
                  },
                },
              },
              {
                // Preload script - must be CJS format for Electron sandbox
                entry: 'electron/preload.js',
                onstart({ reload }) {
                  reload()
                },
                vite: {
                  build: {
                    outDir: 'dist-electron',
                    rollupOptions: {
                      external: ['electron'],
                      output: {
                        format: 'cjs',
                        entryFileNames: '[name].cjs',
                      },
                    },
                  },
                },
              },
            ]),
          ]
        : []),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    // Always use relative paths for compatibility with Electron file:// protocol
    base: './',
    // Clear screen on build
    clearScreen: false,
  }
})
