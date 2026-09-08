export type CaptureDevice = { name?: string; [key: string]: unknown };

export type TelemetryApi = {
  GEOIP_DB_FILENAME: string;
  fetchTelemetryPayload: () => Promise<unknown> | unknown;
  ensureGeoIp: (opts: {
    writablePath: string;
    extraPaths: string[];
    autoDownload?: boolean;
  }) => Promise<unknown> | unknown;
  updateGeoIp: (writablePath: string) => Promise<unknown> | unknown;
  getCaptureStatus: () => unknown;
  resolveMyPublicGeo: (opts: {
    writablePath: string;
    extraPaths: string[];
    cachePath: string;
  }) => Promise<unknown> | unknown;
  listCaptureDevices: () => CaptureDevice[];
  setCaptureDevice: (name: string | null) => unknown;
  startPacketCapture: () => { ok: boolean; device?: string; error?: string };
  stopPacketCapture: () => void;
};

export type FirewallApi = {
  firewallBlockIp: (ip: string, reason?: string) => Promise<unknown> | unknown;
  firewallUnblockIp: (ip: string) => Promise<unknown> | unknown;
  firewallListBlockedIps: () => Promise<{ ok: boolean; ips: Array<{ ip: string; reason?: string }>; error?: string }> | {
    ok: boolean;
    ips: Array<{ ip: string; reason?: string }>;
    error?: string;
  };
};
