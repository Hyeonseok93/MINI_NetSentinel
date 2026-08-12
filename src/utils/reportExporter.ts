import { IpSession, GroupedProcess, GeoNode } from '../types/network';
import { formatBytes } from './formatters';

export const exportAuditReportCsv = (
  sessions: IpSession[],
  processes: GroupedProcess[],
  geoNodes: GeoNode[]
) => {
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const dateFilename = new Date().toISOString().split('T')[0];

  let csvContent = '\uFEFF'; // Add UTF-8 BOM for Excel compatibility

  // SECTION 1: REPORT HEADER
  csvContent += `=== MINI NetSentinel Security Audit Report ===\r\n`;
  csvContent += `Generated At,${nowStr}\r\n`;
  csvContent += `Total Active IP Sessions,${sessions.length}\r\n`;
  csvContent += `Total Monitored Apps,${processes.length}\r\n`;
  csvContent += `Total Geo Destinations,${geoNodes.length}\r\n\r\n`;

  // SECTION 2: ACTIVE IP SESSIONS TABLE
  csvContent += `=== Active & Historical IP Sessions ===\r\n`;
  csvContent += `IP Address,Domain,Location,Country Code,Protocol,Port,Packets In,Packets Out,Total Bytes,Formatted Volume,Status,Is Baseline\r\n`;
  sessions.forEach((s) => {
    const domain = s.domain ? `"${s.domain.replace(/"/g, '""')}"` : 'Unresolved';
    const country = s.country ? `"${s.country.replace(/"/g, '""')}"` : 'Unknown';
    csvContent += `${s.ip},${domain},${country},${s.countryCode || 'UNK'},${s.protocol},${s.port},${s.packetsIn},${s.packetsOut},${s.totalBytes},"${formatBytes(s.totalBytes)}",${s.status},${s.isBaseline}\r\n`;
  });
  csvContent += `\r\n`;

  // SECTION 3: PROCESS APP BREAKDOWN TABLE
  csvContent += `=== Process Bandwidth Consumption Breakdown ===\r\n`;
  csvContent += `Process Name,PID Count,Packets In,Packets Out,Total Bytes,Formatted Volume\r\n`;
  processes.forEach((p) => {
    const procName = `"${p.processName.replace(/"/g, '""')}"`;
    csvContent += `${procName},${p.pids.length},${p.packetsIn},${p.packetsOut},${p.totalBytes},"${formatBytes(p.totalBytes)}"\r\n`;
  });
  csvContent += `\r\n`;

  // SECTION 4: GEO THREAT DESTINATIONS TABLE
  csvContent += `=== Geo Threat Country Distribution ===\r\n`;
  csvContent += `Country,Country Code,Active IP Count,Total Bytes,Formatted Volume\r\n`;
  geoNodes.forEach((g) => {
    const countryName = `"${g.country.replace(/"/g, '""')}"`;
    csvContent += `${countryName},${g.countryCode},${g.activeIpCount},${g.totalBytes},"${formatBytes(g.totalBytes)}"\r\n`;
  });

  // Create Download Blob and Trigger File Download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `NetSentinel_Audit_Report_${dateFilename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
