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
mod updater;
mod url;
mod win_priority;
mod youtube_session;
mod ytdlp;

use jobs::JobsState;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(JobsState::default()))
        .setup(|app| {
            win_priority::boost_app_process();
            bins::ensure_tools().map_err(|e| e.to_string())?;
            let _ = storage::prune_on_startup();
            log::log_line("application démarrée");
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.set_decorations(false);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_video,
            commands::resolve_preview_url,
            commands::start_local_preview,
            commands::cancel_local_preview,
            commands::fetch_metadata,
            commands::get_storyboard,
            commands::get_timeline_filmstrip,
            commands::get_timeline_filmstrip_master,
            commands::release_preview_cache,
            commands::get_settings,
            commands::save_settings_cmd,
            commands::list_presets,
            commands::get_preset,
            commands::save_preset,
            commands::bins_status,
            commands::update_ytdlp,
            commands::download_section,
            commands::run_cut_pipeline,
            commands::start_cut_job_command,
            jobs::cancel_job,
            youtube_session::open_youtube_login,
            youtube_session::close_youtube_login,
            youtube_session::probe_youtube_session,
            youtube_session::pick_cookies_file,
            youtube_session::pick_export_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
