# NetSentinel

Windows Electron + React + Vite network monitor with Npcap capture (Netstat fallback), GeoIP country lookup, and firewall blacklist helpers.

## Develop

```bash
npm install
npm run dev
```

## Portable build

```bash
npm run build:exe
```

Output: `release/NetSentinel/NetSentinel.exe` (ship the whole folder).

## Audit

```bash
npm run audit:wiring
```
