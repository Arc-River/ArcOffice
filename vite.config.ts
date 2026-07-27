import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import ElementPlus from 'unplugin-element-plus/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

const ONLYOFFICE_CDN = 'https://b26830b7.onlyoffice-packages.pages.dev'

export default defineConfig({
  define: {
    __ONLYOFFICE_CDN__: JSON.stringify(ONLYOFFICE_CDN),
  },
  worker: {
    format: 'es',
  },
  plugins: [
    vue(),
    AutoImport({
      resolvers: [ElementPlusResolver()],
      imports: ['vue', 'vue-router', 'pinia'],
      dts: 'src/auto-imports.d.ts',
    }),
    Components({
      resolvers: [ElementPlusResolver()],
      dts: 'src/components.d.ts',
    }),
    ElementPlus({
      useSource: true,
    }),
    electron([
      {
        entry: 'electron/main.ts',
        vite: {
          define: {
            __ONLYOFFICE_CDN__: JSON.stringify(ONLYOFFICE_CDN),
          },
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['sql.js', '@anthropic-ai/sdk'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        vite: {
          plugins: [
            {
              name: 'force-cjs-preload',
              configResolved(config) {
                if (config.build.lib) {
                  config.build.lib.formats = ['cjs']
                }
              },
            },
          ],
          build: {
            outDir: 'dist-electron',
          },
        },
        onstart(args) {
          args.reload()
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/assets/styles/mixins.scss" as *;\n`,
      },
    },
  },
})
