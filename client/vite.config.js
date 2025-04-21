import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    // Ensure the port is correct, default is 5173
    port: 5173, 
    proxy: {
      // Match requests starting with /api
      '/api': {
        // CRITICAL: Ensure this matches EXACTLY where your backend server is running
        target: 'http://localhost:3000', 
        changeOrigin: true, // Necessary for virtual hosted sites
        secure: false, // Often needed for localhost development
        
        // Add logging to see what the proxy is doing
        configure: (proxy, options) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log(`[Vite Proxy] Forwarding request: ${req.method} ${req.url} -> ${options.target}${proxyReq.path}`);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log(`[Vite Proxy] Received response: ${proxyRes.statusCode} ${req.url}`);
          });
          proxy.on('error', (err, req, res) => {
            console.error('[Vite Proxy] Error:', err.message);
            // Ensure the response indicates a proxy error if possible
            if (!res.headersSent) {
              res.writeHead(504, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ message: 'Proxy Error', error: err.message }));
            }
          });
        },
        // Optional: Rewrite path if your server expects paths without /api/blob
        // rewrite: (path) => path.replace(/^\/api\/blob/, '') // Uncomment if server routes don't include /api/blob
      }
    }
  }
});
