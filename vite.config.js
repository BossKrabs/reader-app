import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue' // 找回这个核心插件
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    vue(), // 确保 Vue 插件排在第一位，负责解析 .vue 文件
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: '我的私人阅读器',
        short_name: '阅读器',
        theme_color: '#f4ecd8',
      }
    })
  ]
})