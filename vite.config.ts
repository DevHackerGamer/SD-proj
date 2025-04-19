import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite"; // Import loadEnv
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use the function form of defineConfig to access mode
export default defineConfig(({ mode }) => {
  // Log the mode and the directory Vite expects .env files in
  console.log(`[vite.config.ts] Running in mode: ${mode}`);
  const envDir = path.resolve(__dirname); // Default envDir is the project root
  console.log(`[vite.config.ts] Expecting .env files in: ${envDir}`);

  // Load env files based on mode (optional, Vite does this automatically, but good for debugging)
  const env = loadEnv(mode, envDir, '');
  console.log('[vite.config.ts] Loaded env keys:', Object.keys(env)); // See what keys were loaded

  return {
    root: path.resolve(__dirname, "client"), // Root directory is 'client'
    envDir: envDir, // Explicitly set envDir (usually not needed, defaults to root)
    plugins: [
      tailwindcss(),
      react(),
      tsconfigPaths()
    ],
    build: {
      outDir: path.resolve(__dirname, "build/client"), // Absolute path to output
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, "client/index.html"), // Absolute path to entry point
      },
    },
    server: {
      port: 3000,
      host: true, // Listen on all addresses, including network IPs
      open: true, // Automatically open browser
      proxy: {
        "/api": {
          target: "http://localhost:5000", // Backend server for API
          changeOrigin: true,
          secure: false,
        },
      },
    },
    define: {
      // Only expose specific non-VITE prefixed variables if absolutely necessary
      // 'process.env.NODE_ENV': JSON.stringify(mode), // Use mode directly
      // 'process.env.API_URL': JSON.stringify(env.API_URL || 'http://localhost:5000'),
    },
  };
});
