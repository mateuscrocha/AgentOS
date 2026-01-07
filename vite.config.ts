import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

function stripeStatusDevPlugin(mode: string): Plugin {
  return {
    name: "stripe-status-dev",
    apply: "serve",
    configureServer(server) {
      const env = loadEnv(mode, process.cwd(), "");
      const secretKey = (env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY || "").trim();

      const mask = (key: string): string => {
        const last4 = key.slice(-4);
        const m = key.match(/^(sk|rk)_(live|test)_/);
        const prefix = m?.[0] || "key_";
        return `${prefix}${"•".repeat(12)}${last4}`;
      };

      server.middlewares.use("/__stripe/status", (req, res) => {
        if ((req.method || "GET").toUpperCase() !== "GET") {
          res.statusCode = 405;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: false, message: "Method not allowed" }));
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(
          JSON.stringify({
            success: true,
            has_key: !!secretKey,
            masked_key: secretKey ? mask(secretKey) : "Não configurado",
            updated_at: null,
            managed_by: "env",
          }),
        );
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger(), mode === "development" && stripeStatusDevPlugin(mode)].filter(Boolean),
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
}));
