import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const categoryRulesPath = path.resolve(__dirname, "data/category-rules.json");

function categoryRulesApiPlugin() {
  const handler = async (req, res) => {
    if (!req.url?.startsWith("/api/category-rules")) {
      return false;
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");

    if (req.method === "GET") {
      try {
        const content = await fs.readFile(categoryRulesPath, "utf8");
        res.end(content);
      } catch {
        res.statusCode = 200;
        res.end("{}");
      }

      return true;
    }

    if (req.method === "POST") {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk;
      });

      req.on("end", async () => {
        try {
          const parsed = JSON.parse(body || "{}");
          await fs.mkdir(path.dirname(categoryRulesPath), { recursive: true });
          await fs.writeFile(categoryRulesPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
          res.statusCode = 200;
          res.end(JSON.stringify({ ok: true }));
        } catch (error) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              ok: false,
              error: error instanceof Error ? error.message : "Erro ao salvar regras"
            })
          );
        }
      });

      return true;
    }

    res.statusCode = 405;
    res.end(JSON.stringify({ ok: false, error: "Método não permitido" }));
    return true;
  };

  const attachMiddleware = (server) => {
    server.middlewares.use((req, res, next) => {
      handler(req, res).then((handled) => {
        if (!handled) {
          next();
        }
      });
    });
  };

  return {
    name: "category-rules-api",
    configureServer(server) {
      attachMiddleware(server);
    },
    configurePreviewServer(server) {
      attachMiddleware(server);
    }
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), categoryRulesApiPlugin()],
  server: {
    watch: {
      ignored: ["**/data/category-rules.json"]
    }
  },
  preview: {
    watch: {
      ignored: ["**/data/category-rules.json"]
    }
  }
});
