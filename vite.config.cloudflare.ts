import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      root: path.resolve(__dirname, 'src'),
      server: {
        port: 3000,
        host: '0.0.0.0',
        allowedHosts: ['3000.code.good365.net','4173.code.good365.net'],
        watch: {
          // 排除node_modules（依赖包无需热更新，占大量监视器）
          // 排除dist（构建产物目录）、.git（版本控制目录）、*.log（日志文件）等
          ignored: [
            /node_modules/,
            /dist/,
            /\.git/,
            /\.log$/,
            /tmp/,
            // 可根据项目情况添加其他无需监听的目录，如：/public/assets/large-files
          ]
        }
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
        outDir: path.resolve(__dirname, 'build'),
        emptyOutDir: true,  // 添加这一行
        assetsDir: 'assets',
        rollupOptions: {
          output: {
            manualChunks: {
              // 拆分React核心全家桶为单独chunk
              reactVendor: ['react', 'react-dom'],
              // 拆分大体积UI组件库（如Antd/MUI/Element-React）
              uiLib: ['lucide-react'],
              // 拆分大体积工具库（如axios/echarts/lodash/moment）
              utilsLib: ['@google/genai'],
            }
          }
        }
      }
    };
});
