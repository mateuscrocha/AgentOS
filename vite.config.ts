import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  void env;

  return {
    server: {
      host: "::",
      port: 8080,
    },
    define: {},
    optimizeDeps: {
      force: true,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return;

            if (id.includes("@supabase/")) {
              return "supabase-vendor";
            }

            if (id.includes("@tanstack/react-query")) {
              return "query-vendor";
            }

            if (id.includes("react-router") || id.includes("@remix-run/router")) {
              return "router-vendor";
            }

            if (id.includes("@radix-ui/") || id.includes("cmdk") || id.includes("vaul")) {
              return "ui-radix-vendor";
            }

            if (id.includes("framer-motion") || id.includes("motion-")) {
              return "motion-vendor";
            }

            // Recharts can break with TDZ/circular init issues when Rollup splits its
            // internals into multiple production chunks (e.g. chart + generateCategoricalChart).
            // Keep charting stack together in one chunk.
            if (
              id.includes("/recharts/") ||
              id.includes("/victory-vendor/") ||
              id.includes("/d3-")
            ) {
              return "charts-vendor";
            }

            if (id.includes("react") || id.includes("scheduler")) {
              return "react-vendor";
            }
          },
        },
      },
    },
    test: {
      environment: "jsdom",
      globals: true,
      include: ["src/**/*.test.{ts,tsx}"],
      setupFiles: ["./src/test/setup.ts"],
    },
  };
});
