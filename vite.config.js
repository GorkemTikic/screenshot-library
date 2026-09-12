import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, readFileSync } from 'node:fs'

// Copies the live catalog into the built site so the app can fetch it
// same-origin (<base>/data.json). Required since the repo went private
// (2026-06-11): raw.githubusercontent.com URLs need auth on private repos,
// but the GitHub Pages site stays public. Every Admin Unified Sync push
// triggers a redeploy, so the served data.json is always current.
const copyLiveData = {
  name: 'copy-live-data',
  configureServer(server) {
    server.middlewares.use((request, response, next) => {
      const pathname = new URL(request.url, 'http://local').pathname
      if (pathname !== '/screenshot-library/data.json' && pathname !== '/data.json') return next()
      response.setHeader('Content-Type', 'application/json; charset=utf-8')
      response.setHeader('Cache-Control', 'no-store')
      response.end(readFileSync('src/data/data.json'))
    })
  },
  closeBundle() {
    copyFileSync('src/data/data.json', 'dist/data.json')
  },
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyLiveData],
  base: '/screenshot-library/',
})
