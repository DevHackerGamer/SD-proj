import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { configDefaults } from "vitest/config"; 


export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  define: {
    'process.env': process.env,
  },
  test: {
    globals: true,
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
    
});
