/**
 * Thin re-export — data lives in shared/famous-ips.json.
 */
const data = require('../../shared/famous-ips.json');

module.exports = {
  FAMOUS_DOMAIN_BY_IP: Object.freeze(data.famousDomainByIp),
  DEFAULT_TRUSTED_IPS: Object.freeze(data.defaultTrustedIps),
};
