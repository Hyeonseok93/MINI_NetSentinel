import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const telemetry = require(path.resolve(__dirname, "scripts/telemetry-core.cjs"));

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
