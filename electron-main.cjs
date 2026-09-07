/** Thin CJS entry — Electron main is TypeScript compiled to electron/dist/main.js */
const fs = require('fs');
const path = require('path');

const mainJs = path.join(__dirname, 'electron', 'dist', 'main.js');
if (!fs.existsSync(mainJs)) {
  console.error(
    '[NetSentinel] Missing electron/dist/main.js.\n' +
      'Run: npm run build:electron\n' +
      '(Also runs automatically via npm prepare / npm run build / build:exe.)'
  );
  process.exit(1);
}
require(mainJs);
