import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: '/ai/mandirector-ai/', // 替换为你的实际二级路径：比如仓库名是my-react-proj，就写/base: '/my-react-proj/'
      root: path.resolve(__dirname, 'src'),
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['3000.code.good365.net','4173.code.good365.net']
      },
      plugins: [
        react(),
        tailwindcss(),
        VitePWA({
          buildBase: '/',
          outDir: path.resolve(__dirname, 'dist'),
          registerType: 'autoUpdate',
          workbox: {
            globDirectory: path.resolve(__dirname, 'dist'),
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            globIgnores: [
              'node_modules/**/*',
              'sw.js',
              'workbox-*.js'
            ]
          },
          includeAssets: ['128x128.png', '192x192.png', '512x512.png'],
          manifest: {
            name: 'AI漫剧工场',
            short_name: 'AI漫剧',
            description: 'AI驱动的漫画创作工具',
            start_url: '/',
            theme_color: '#0e1229',
            background_color: '#0e1229',
            display: 'standalone',
            icons: [
              {
                src: '192x192.png',
                sizes: '192x192',
                type: 'image/png'
              },
              {
                src: '512x512.png',
                sizes: '512x512',
                type: 'image/png'
              },
              {
                src: '512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ]
          },
          devOptions: { enabled: true },
          // 4. 自动注入Manifest和Service Worker到index.html
          injectRegister: 'auto'
        })
      ],
      define: {
        'process.env.VOLCENGINE_API_KEY': JSON.stringify(env.VOLCENGINE_API_KEY),
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, 'src'),
        }
      },
      build: {
        outDir: path.resolve(__dirname, 'dist'),
        emptyOutDir: true,  // 添加这一行
        assetsDir: 'assets',
        rollupOptions: {
          output: {
            // 使用函数形式的 manualChunks 实现精细分包
            manualChunks(id) {
              // ---- 第三方大体积库 ----
              if (id.includes('/node_modules/framer-motion/')) return 'vendor-framer-motion';
              if (id.includes('/node_modules/react-resizable-panels/')) return 'vendor-resizable-panels';
              if (id.includes('/node_modules/@radix-ui/')) return 'vendor-radix-ui';
              if (id.includes('/node_modules/ai/') || id.includes('/node_modules/@ai-sdk/')) return 'vendor-ai-sdk';
              if (id.includes('/node_modules/@google/genai/')) return 'utilsLib';
              if (id.includes('/node_modules/lucide-react/')) return 'uiLib';
              if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'reactVendor';

              // ---- CutOSEditor 编辑器组件 ----
              if (id.includes('/components/CutOSEditor/')) return 'cutos-editor';

              // ---- 提示词组模版 ----
              if (id.includes('/prompt/groups/')) {
                const match = id.match(/groups\/([\w-]+)\.ts$/);
                return match ? `prompt-${match[1]}` : 'prompt-groups';
              }
            }
          }
        }
      }
    };
});
