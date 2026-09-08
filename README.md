# NetSentinel

Windows **Electron + React + Vite** network monitor: live connection inventory (Npcap bytes when available, Netstat fallback), GeoIP country labels, and **manual** Windows Firewall block helpers.

This is a personal / portable utility — not an enterprise threat-detection product.

## Requirements

- Windows 10/11
- [Npcap](https://npcap.com/) recommended for packet byte counters (without it, Netstat mode lists TCP connections only)
- **Administrator** privileges to add/remove Windows Firewall rules
- Portable builds must ship the **entire** `release/NetSentinel/` folder (not a lone `.exe`)

## Develop

```bash
npm install
npm run dev
```

Electron main is TypeScript (`npm run build:electron` / `prepare`). IPC channels live in `shared/ipc-channels.json`.

## Portable build

```bash
npm run build:exe
```

Output: `release/NetSentinel/NetSentinel.exe` (ship the whole folder).

**Unsigned build:** code signing is not configured. Windows SmartScreen may warn on first run — expected for local/portable builds.

## Limits (read this)

- **IPv4 + TCP ESTABLISHED** focused. IPv6 and UDP visibility are weak or absent.
- **Spike** status means traffic above your packet/s threshold — not malware classification.
- Blocking is **manual** only (Trusted / Verified / Blacklist). There is no auto threat block.
- Trusted / Verified / Blacklist and monitoring settings persist as JSON under Electron `userData/store/` (not browser `localStorage`). Blacklist also syncs with NetSentinel-named Windows Firewall rules when possible.
- Vite `npm run dev` uses the same store shape under `data/dev-user-store/`.

## Persistence paths

| Runtime | Location |
|---------|----------|
| Portable / Electron | `%APPDATA%/NetSentinel/store/` (`monitoring-config.json`, `membership.json`) |
| Vite dev | `data/dev-user-store/` |
| OS firewall blocks | Windows rules named `NetSentinel Block OUT/IN <ip>` |

## GeoIP / MaxMind GeoLite2

Country lookup uses a **GeoLite2-Country** database (`data/GeoLite2-Country.mmdb`), downloaded from a checksum-verified third-party mirror at build/update time.

This product includes GeoLite2 data created by MaxMind, available from
[https://www.maxmind.com](https://www.maxmind.com).

GeoLite2 is subject to the MaxMind GeoLite2 EULA / attribution requirements. Prefer obtaining databases via your own MaxMind account for production redistribution. NetSentinel does not claim affiliation with MaxMind.

## License

MIT — see [LICENSE](./LICENSE). Third-party components (Electron, Npcap, MaxMind GeoLite2, etc.) keep their own licenses.

## Audit / tests

```bash
npm test                 # unit tests (IPv4, membership, IPC channel sync)
npm run audit:wiring     # full local wiring + live capture smoke (Windows)
npm run audit:offline    # CI-safe audit without live Npcap
```
