mod bins;
mod commands;
mod error;
mod ffmpeg;
mod filmstrip;
mod format;
mod jobs;
mod log;
mod presets;
mod process;
mod settings;
mod storage;
mod storyboard;
mod url;
mod win_priority;
mod ytdlp;

use jobs::JobsState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(Arc::new(JobsState::default()))
        .setup(|app| {
            win_priority::boost_app_process();
            if let Err(error) = bins::ensure_tools() {
                log::log_line(&format!(
                    "installation des binaires impossible, réessayez plus tard: {error}"
                ));
            }
            match settings::load() {
                Ok(config) if config.auto_update_ytdlp => {
                    if let Err(error) = bins::update_ytdlp_manual() {
                        log::log_line(&format!("mise à jour automatique yt-dlp échouée: {error}"));
                    }
                }
                Ok(_) => {}
                Err(error) => {
                    log::log_line(&format!(
                        "impossible de lire le réglage de mise à jour yt-dlp: {error}"
                    ));
                }
            }
            let _ = storage::prune_on_startup();
            log::log_line("application démarrée");
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_decorations(false);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_video,
            commands::reveal_file,
            commands::resolve_preview_url,
            commands::start_local_preview,
            commands::cancel_local_preview,
            commands::get_timeline_filmstrip,
            commands::get_timeline_filmstrip_master,
            commands::release_preview_cache,
            commands::get_settings,
            commands::save_settings_cmd,
            commands::list_presets,
            commands::update_ytdlp,
            commands::pick_export_directory,
            commands::start_cut_job_command,
            jobs::cancel_job,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
