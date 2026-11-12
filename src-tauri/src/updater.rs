//! M4 : plugin Tauri updater. M1 : point d’extension uniquement.

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct AppUpdateInfo {
    pub available: bool,
}

#[allow(dead_code)]
pub fn check_app_update() -> AppUpdateInfo {
    AppUpdateInfo { available: false }
}
