/** Official Npcap download — do not bundle redistributed installers in-repo. */
export const NPCAP_DOWNLOAD_URL = 'https://npcap.com/#download';
export const MAXMIND_HOME_URL = 'https://www.maxmind.com';
export const ALLOWED_EXTERNAL_URLS = new Set([
  NPCAP_DOWNLOAD_URL,
  'https://npcap.com/',
  MAXMIND_HOME_URL,
  'https://www.maxmind.com/',
]);

export const NORMAL_MIN_WIDTH = 1200;
export const NORMAL_MIN_HEIGHT = 760;
export const FLOAT_WIDTH = 410;
export const FLOAT_HEIGHT = 370;
export const FLOAT_MIN_WIDTH = 410;
export const FLOAT_MIN_HEIGHT = 370;

export type Rectangle = { x: number; y: number; width: number; height: number };
