use crate::ytdlp;
use tauri::{AppHandle, Manager, WebviewWindowBuilder};

const LOGIN_LABEL: &str = "youtube-login";

#[tauri::command]
pub fn open_youtube_login(app: AppHandle) -> Result<(), String> {
    if app.get_webview_window(LOGIN_LABEL).is_some() {
        return Ok(());
    }
    let url = tauri::WebviewUrl::External(
        "https://www.youtube.com"
            .parse()
            .map_err(|e: url::ParseError| e.to_string())?,
    );
    WebviewWindowBuilder::new(&app, LOGIN_LABEL, url)
        .title("Connexion YouTube — Dollyt")
        .inner_size(520.0, 780.0)
        .center()
        .build()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn close_youtube_login(app: AppHandle) -> Result<(), String> {
    if let Some(w) = app.get_webview_window(LOGIN_LABEL) {
        let _ = w.close();
    }
    Ok(())
}

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
