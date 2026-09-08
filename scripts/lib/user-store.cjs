/**
 * Allowlisted JSON files under a store directory (Electron userData/store or Vite data/dev-user-store).
 * Atomic writes via temp + rename.
 */
const fs = require('fs');
const path = require('path');
const { normalizeIpv4 } = require('../../shared/ipv4.cjs');

const ALLOWED_KEYS = Object.freeze(['monitoring-config', 'membership']);

function assertKey(key) {
  const k = String(key || '');
  if (!ALLOWED_KEYS.includes(k)) {
    throw new Error(`Unknown user-store key: ${key}`);
  }
  return k;
}

function emptyMembership() {
  return { version: 1, trusted: [], verified: [], blocked: [] };
}

function sanitizeTrustedList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const ip = normalizeIpv4(item.ip);
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);
    const domain = item.domain;
    out.push({
      ip,
      ...(typeof domain === 'string' && domain.trim()
        ? { domain: domain.trim().slice(0, 120) }
        : {}),
    });
  }
  return out;
}

function sanitizeBlockedList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const ip = normalizeIpv4(item.ip);
    if (!ip || seen.has(ip)) continue;
    seen.add(ip);
    const blockedAt = Number(item.blockedAt);
    out.push({
      ip,
      reason: String(item.reason || 'Blocked').slice(0, 120),
      blockedAt: Number.isFinite(blockedAt) && blockedAt > 0 ? blockedAt : Date.now(),
    });
  }
  return out;
}

function sanitizeMembership(raw) {
  if (!raw || typeof raw !== 'object') return emptyMembership();
  return {
    version: 1,
    trusted: sanitizeTrustedList(raw.trusted),
    verified: sanitizeTrustedList(raw.verified),
    blocked: sanitizeBlockedList(raw.blocked),
  };
}

function sanitizeMonitoringConfig(raw, defaults) {
  const base = defaults && typeof defaults === 'object' ? defaults : {};
  if (!raw || typeof raw !== 'object') return { ...base };
  const {
    isMonitoring: _ignored,
    autoBlockSuspicious: _removed,
    ...rest
  } = raw;
  return { ...base, ...rest };
}

function createUserStore(baseDir) {
  const root = path.resolve(baseDir);

  function fileFor(key) {
    return path.join(root, `${assertKey(key)}.json`);
  }

  function readJson(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const text = fs.readFileSync(filePath, 'utf8');
    if (!text.trim()) return null;
    return JSON.parse(text);
  }

  function writeAtomic(filePath, value) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), 'utf8');
    fs.renameSync(tmp, filePath);
  }

  function read(key) {
    const k = assertKey(key);
    try {
      const raw = readJson(fileFor(k));
      if (k === 'membership') return sanitizeMembership(raw);
      if (k === 'monitoring-config') {
        return raw && typeof raw === 'object' ? sanitizeMonitoringConfig(raw, {}) : null;
      }
      return raw;
    } catch (err) {
      return null;
    }
  }

  function write(key, value) {
    const k = assertKey(key);
    let payload = value;
    if (k === 'membership') payload = sanitizeMembership(value);
    if (k === 'monitoring-config') {
      if (!value || typeof value !== 'object') {
        throw new Error('monitoring-config must be an object');
      }
      payload = sanitizeMonitoringConfig(value, {});
    }
    writeAtomic(fileFor(k), payload);
    return { ok: true, key: k };
  }

  return {
    root,
    read,
    write,
    sanitizeMembership,
    sanitizeMonitoringConfig,
    emptyMembership,
  };
}

module.exports = {
  ALLOWED_KEYS,
  createUserStore,
  sanitizeMembership,
  sanitizeBlockedList,
  sanitizeTrustedList,
  sanitizeMonitoringConfig,
  emptyMembership,
};
