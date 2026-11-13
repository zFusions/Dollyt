use crate::ytdlp;

#[tauri::command]
pub fn probe_youtube_session() -> Result<(), String> {
    ytdlp::probe_youtube().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pick_cookies_file() -> Result<Option<String>, String> {
    let path = rfd::FileDialog::new()
        .add_filter("Cookies Netscape", &["txt"])
        .pick_file();
    Ok(path.map(|p| p.to_string_lossy().into_owned()))
}

#[tauri::command]
pub fn pick_export_directory() -> Result<Option<String>, String> {
    let path = rfd::FileDialog::new().pick_folder();
    Ok(path.map(|p| p.to_string_lossy().into_owned()))
}
