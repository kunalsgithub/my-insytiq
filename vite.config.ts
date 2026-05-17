import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname);
const srcRoot = path.resolve(projectRoot, "src");

// https://vitejs.dev/config/
export default defineConfig(() => ({
  root: projectRoot,
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": srcRoot,
    },
  },
}));
