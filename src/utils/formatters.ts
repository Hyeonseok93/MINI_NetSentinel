/**
 * Formats a byte number into human-readable B, KB, MB, GB, or TB string.
 */
export const formatBytes = (bytes: number): string => {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n < 1024 * 1024 * 1024 * 1024) return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  return `${(n / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
};

/** Convert settings quota value + unit into bytes. */
export function quotaToBytes(value: number, unit: 'KB' | 'MB' | 'GB' | 'TB'): number {
  const mult =
    unit === 'KB'
      ? 1024
      : unit === 'MB'
        ? 1024 * 1024
        : unit === 'GB'
          ? 1024 * 1024 * 1024
          : 1024 * 1024 * 1024 * 1024;
  return (value || 0) * mult;
}
