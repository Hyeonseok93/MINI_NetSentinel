/**
 * Rank Npcap adapters — prefer real Wi-Fi/Ethernet, demote virtual/loopback.
 * @param {{ name: string, description?: string }} device
 * @param {string | null} [preferred]
 */
function scoreCaptureDevice(device, preferred = null) {
  const desc = `${device.description || ''} ${device.name}`.toLowerCase();
  let score = 0;
  if (preferred && (device.name === preferred || device.description === preferred)) score += 1000;
  if (
    desc.includes('loopback') ||
    desc.includes('npcap loopback') ||
    desc.includes('hyper-v') ||
    desc.includes('vmware') ||
    desc.includes('virtualbox') ||
    desc.includes('bluetooth') ||
    desc.includes('wan miniport') ||
    desc.includes('vpn') ||
    desc.includes('virtual')
  ) {
    score -= 100;
  }
  if (desc.includes('wi-fi') || desc.includes('wifi') || desc.includes('wlan') || desc.includes('802.11')) {
    score += 40;
  }
  if (
    desc.includes('realtek') ||
    desc.includes('intel') ||
    desc.includes('broadcom') ||
    desc.includes('qualcomm')
  ) {
    score += 35;
  }
  if (desc.includes('gbe') || desc.includes('gigabit') || desc.includes('ethernet')) score += 20;
  if (device.description) score += 5;
  return score;
}

/**
 * @param {Array<{ name: string, description?: string }>} devices
 * @param {string | null} [preferred]
 */
function rankCaptureDevices(devices, preferred = null) {
  return devices
    .map((d) => ({ d, score: scoreCaptureDevice(d, preferred) }))
    .sort((a, b) => b.score - a.score);
}

module.exports = { scoreCaptureDevice, rankCaptureDevices };
