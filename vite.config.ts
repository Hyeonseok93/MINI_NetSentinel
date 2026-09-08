import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import fs from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const telemetry = require(path.resolve(__dirname, "scripts/telemetry-core.cjs"));
const { createUserStore, ALLOWED_KEYS } = require(
  path.resolve(__dirname, "scripts/lib/user-store.cjs")
);

function liveNetstatPlugin(): Plugin {
  return {
    name: "live-netstat-plugin",
    configureServer(server) {
      // Dev-only HTTP mirror of Electron IPC get-live-netstat (same telemetry-core).
      // Production portable builds use preload IPC only — this path is intentional.
      // Warm GeoIP once for localhost dev (uses bundled data/GeoLite2-Country.mmdb)
      telemetry
        .ensureGeoIp({
          writablePath: path.resolve(__dirname, "data", telemetry.GEOIP_DB_FILENAME),
          autoDownload: true,
        })
        .catch((err: Error) => console.warn("[vite] GeoIP init:", err.message));

      const devStore = createUserStore(path.resolve(__dirname, "data", "dev-user-store"));

      server.middlewares.use("/api/live-netstat", async (_req, res) => {
        try {
          const payload = await telemetry.fetchTelemetryPayload();
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(payload));
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              ok: false,
              sessions: [],
              processes: [],
              error: err?.message || String(err),
            })
          );
        }
      });

      // Dev mirror of Electron user-store-get / user-store-set (files under data/dev-user-store).
      server.middlewares.use("/api/user-store", async (req, res) => {
        try {
          const url = new URL(req.url || "/", "http://localhost");
          const key = url.pathname.replace(/^\/+/, "").split("/")[0];
          if (!key || !(ALLOWED_KEYS as string[]).includes(key)) {
            res.statusCode = 404;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: false, error: `Unknown key: ${key}` }));
            return;
          }

          if (req.method === "GET") {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, key, value: devStore.read(key) }));
            return;
          }

          if (req.method === "PUT" || req.method === "POST") {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
            const value = body && typeof body === "object" && "value" in body ? body.value : body;
            devStore.write(key, value);
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ ok: true, key }));
            return;
          }

          res.statusCode = 405;
          res.end("Method Not Allowed");
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: false, error: err?.message || String(err) }));
        }
      });

      try {
        fs.mkdirSync(path.resolve(__dirname, "data", "dev-user-store"), { recursive: true });
      } catch {
        /* ignore */
      }
    },
  };
}

export default defineConfig(async () => ({
  base: "./",
  plugins: [react(), tailwindcss(), liveNetstatPlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
}));
