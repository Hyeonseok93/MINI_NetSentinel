use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IpPacketSummary {
    pub id: String,
    pub ip: String,
    pub domain: Option<String>,
    pub country: String,
    pub country_code: String,
    pub packets_in: u64,
    pub packets_out: u64,
    pub total_packets: u64,
    pub bytes_in: u64,
    pub bytes_out: u64,
    pub total_bytes: u64,
    pub last_seen: String,
    pub status: String,
    pub protocol: String,
    pub port: u16,
    pub is_baseline: bool,
}

#[derive(Debug, Default)]
pub struct NativeNetworkMonitor {
    pub sessions: HashMap<String, IpPacketSummary>,
}

impl NativeNetworkMonitor {
    pub fn new() -> Self {
        Self {
            sessions: HashMap::new(),
        }
    }

    pub fn fetch_live_sessions(&mut self) -> Vec<IpPacketSummary> {
        // Collect real Windows network connections via Windows API / Netstat
        let now = chrono::Local::now().format("%H:%M:%S").to_string();

        #[cfg(target_os = "windows")]
        {
            use std::process::Command;
            let output = Command::new("cmd")
                .args(&["/C", "netstat -n -p TCP"])
                .output();

            if let Ok(out) = output {
                let stdout = String::from_utf8_lossy(&out.stdout);
                for line in stdout.lines() {
                    let parts: Vec<&str> = line.split_whitespace().collect();
                    if parts.len() >= 4 && parts[0] == "TCP" && parts[3] == "ESTABLISHED" {
                        let foreign_addr = parts[2];
                        if let Some((ip, port_str)) = foreign_addr.rsplit_once(':') {
                            if ip != "127.0.0.1" && ip != "0.0.0.0" && !ip.starts_with("[::") {
                                let port = port_str.parse::<u16>().unwrap_or(443);
                                let entry = self.sessions.entry(ip.to_string()).or_insert_with(|| {
                                    IpPacketSummary {
                                        id: format!("ip-real-{}", ip.replace('.', "-")),
                                        ip: ip.to_string(),
                                        domain: resolve_simple_domain(ip),
                                        country: resolve_country(ip),
                                        country_code: "NET".to_string(),
                                        packets_in: 1,
                                        packets_out: 1,
                                        total_packets: 2,
                                        bytes_in: 128,
                                        bytes_out: 64,
                                        total_bytes: 192,
                                        last_seen: now.clone(),
                                        status: if is_suspicious_ip(ip, port) { "suspicious".to_string() } else { "normal".to_string() },
                                        protocol: "TCP".to_string(),
                                        port,
                                        is_baseline: is_known_safe(ip),
                                    }
                                });

                                // Increment packet counters for live active connections
                                entry.packets_in += 1;
                                entry.packets_out += 1;
                                entry.total_packets = entry.packets_in + entry.packets_out;
                                entry.bytes_in += 128;
                                entry.bytes_out += 64;
                                entry.total_bytes = entry.bytes_in + entry.bytes_out;
                                entry.last_seen = now.clone();
                            }
                        }
                    }
                }
            }
        }

        let mut list: Vec<IpPacketSummary> = this_sessions_values(&self.sessions);
        list.sort_by(|a, b| b.total_packets.cmp(&a.total_packets));
        list
    }
}

fn this_sessions_values(sessions: &HashMap<String, IpPacketSummary>) -> Vec<IpPacketSummary> {
    sessions.values().cloned().collect()
}

fn resolve_simple_domain(ip: &str) -> Option<String> {
    if ip.starts_with("192.168.") || ip.starts_with("10.") {
        Some("router.local".to_string())
    } else if ip.starts_with("8.8.8") {
        Some("dns.google".to_string())
    } else if ip.starts_with("1.1.1") {
        Some("one.one.one.one".to_string())
    } else if ip.starts_with("142.250.") || ip.starts_with("172.217.") {
        Some("google.com".to_string())
    } else if ip.starts_with("13.107.") || ip.starts_with("20.198.") || ip.starts_with("52.") {
        Some("microsoft.com".to_string())
    } else if ip.starts_with("104.16.") || ip.starts_with("104.18.") {
        Some("cloudflare.com".to_string())
    } else {
        None
    }
}

fn resolve_country(ip: &str) -> String {
    if ip.starts_with("192.168.") || ip.starts_with("10.") {
        "Local Network".to_string()
    } else if ip.starts_with("185.220.") || ip.starts_with("45.154.") {
        "Russia/EastEU".to_string()
    } else {
        "United States".to_string()
    }
}

fn is_suspicious_ip(ip: &str, port: u16) -> bool {
    port == 4444 || port == 9001 || ip.starts_with("185.220.") || ip.starts_with("45.154.")
}

fn is_known_safe(ip: &str) -> bool {
    ip.starts_with("192.168.") || ip.starts_with("8.8.8.") || ip.starts_with("1.1.1.") || ip.starts_with("142.250.") || ip.starts_with("13.107.")
}
