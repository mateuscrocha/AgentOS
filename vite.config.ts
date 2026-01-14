import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const appUrl = env.APP_URL?.trim() ? env.APP_URL.trim().replace(/\/+$/, "") : undefined;

  return {
  server: {
    host: "::",
    port: 8080,
  },
  define: {
    "process.env.APP_URL": appUrl ? JSON.stringify(appUrl) : "undefined",
  },
  optimizeDeps: {
    force: true,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
  };
});
