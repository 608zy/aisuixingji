import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @dcloudio/uni-cloud 会静态 import "@/pages.json"；独立 Vite 工程需解析该路径。用占位 JSON，避免把小程序根目录 pages.json（含注释/密钥）打进浏览器包。 */
const pagesJsonStub = path.resolve(__dirname, 'uni-cloud-pages.stub.json')

export default defineConfig(({ mode }) => ({
  root: '.',
  resolve: {
    alias: {
      '@/pages.json': pagesJsonStub
    }
  },
  server: {
    port: 5174,
    open: true
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'production' ? 'production' : 'development'),
    'process.env.RUN_BY_HBUILDERX': 'false',
    'process.env.UNI_APP_ID': JSON.stringify('admin-web'),
    'process.env.UNI_CLOUD_PROVIDER': JSON.stringify('[]'),
    'process.env.UNI_PLATFORM': JSON.stringify('h5'),
    'process.env.UNI_SECURE_NETWORK_CONFIG': 'undefined',
    'process.env.UNI_SECURE_NETWORK_ENABLE': 'false',
    'process.env.UNICLOUD_DEBUG': 'undefined'
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets'
  }
}))
