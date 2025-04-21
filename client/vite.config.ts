import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
    plugins: [react(), tsconfigPaths()],
    server: {
        port: 3000,
        proxy: {
            // Ensure '/api' requests are proxied to your backend
            '/api': {
                target: 'http://localhost:5000', // <<< CHANGE THIS TO 5000 (Backend Port)
                changeOrigin: true,
                secure: false,      
                // Optional: Add rewrite if your backend expects paths without /api prefix
                // rewrite: (path) => path.replace(/^\/api/, ''), 
                
                // Optional: Add logging for debugging proxy issues
                configure: (proxy, _options) => {
                    proxy.on('error', (err, _req, _res) => {
                        console.log('vite proxy error:', err);
                    });
                    proxy.on('proxyReq', (proxyReq, req, _res) => {
                        console.log('vite Sending Request to the Target:', proxyReq.method, proxyReq.host, proxyReq.path);
                    });
                    proxy.on('proxyRes', (proxyRes, req, _res) => {
                        console.log('vite Received Response from the Target:', proxyRes.statusCode, req.url);
                    });
                }
            }
        }
    }
});