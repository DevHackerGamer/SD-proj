import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite"; // Import loadEnv
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import { fileURLToPath } from "url";
import { configDefaults } from "vitest/config"; 

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Use the function form of defineConfig to access mode
export default defineConfig(({ mode }) => {
  // Log the mode and the directory Vite expects .env files in
  console.log(`[vite.config.ts] Running in mode: ${mode}`);
  const envDir = path.resolve(__dirname); // Default envDir is the project root
  console.log(`[vite.config.ts] Expecting .env files in: ${envDir}`);

  // Load env files based on mode (optional, Vite does this automatically, but good for debugging)
  const env = loadEnv(mode, path.resolve(__dirname), ''); // Load from project root
  console.log('[vite.config.ts] Loaded env keys:', Object.keys(env)); // See what keys were loaded

  return {
    root: path.resolve(__dirname, "client"), // Root directory is 'client'
    envDir: path.resolve(__dirname), // Look for .env files in project root
    envPrefix: 'VITE_', // Ensure only VITE_ prefixed vars are exposed client-side
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
      port: 3000, // Explicitly set the port. Change if 3000 is often busy.
      strictPort: true, // Add this line - Vite will exit if the port is already in use
      host: true, // Listen on all addresses, including network IPs
      open: true, // Automatically open browser
      proxy: {
        "/api": {
          // Use environment variable for backend target, default to 5000
          target: process.env.VITE_API_URL || "http://localhost:5000", 
          changeOrigin: true,
          secure: false,
        },
      },
    },
    test: {
      globals: true,
      setupFiles: "tests/setup.ts",
      passWithNoTests: true,
      environment: "jsdom",
      coverage: {
        provider: "v8", 
        reporter: ["text", "json", "html"],
        exclude: [
          ...(configDefaults.coverage?.exclude || []),
          "src/mocks",
          "tests/setup.ts"
        ],
      },
    },
    resolve: {
      // Add this to help resolve Node.js built-in modules for Azure SDK
      alias: {
        crypto: 'crypto-browserify',
        stream: 'stream-browserify',
        path: 'path-browserify',
        os: 'os-browserify/browser',
        fs: 'browserify-fs',
        '@': path.resolve(__dirname, './src'), // Ensure alias is correctly set if you use it
      },
    },
    optimizeDeps: {
      // Include Azure SDK dependencies for better optimization
      include: ['@azure/storage-blob'],
      esbuildOptions: {
        // Node.js global to browser globalThis
        define: {
          global: 'globalThis',
        },
      },
    },
  };
});
