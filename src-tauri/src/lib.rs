mod packet;

use packet::{IpPacketSummary, NativeNetworkMonitor};
use std::sync::{Arc, Mutex};
use tauri::State;

struct AppState {
    monitor: Arc<Mutex<NativeNetworkMonitor>>,
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! NetSentinel Rust engine active.", name)
}

#[tauri::command]
fn get_network_sessions(state: State<'_, AppState>) -> Vec<IpPacketSummary> {
    if let Ok(mut monitor) = state.monitor.lock() {
        monitor.fetch_live_sessions()
    } else {
        vec![]
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let monitor = Arc::new(Mutex::new(NativeNetworkMonitor::new()));

    tauri::Builder::default()
        .manage(AppState { monitor })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet, get_network_sessions])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
