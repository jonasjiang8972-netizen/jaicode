use serde::{Deserialize, Serialize};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use tauri::Manager;

#[derive(Debug, Serialize, Deserialize)]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ChatRequest {
    message: String,
    mode: String,
    provider: String,
    messages: Vec<ChatMessage>,
}

#[derive(Debug, thiserror::Error, Serialize)]
#[serde(tag = "type", content = "message")]
enum AppError {
    #[error("Backend not running")]
    BackendNotRunning,
    #[error("Request failed: {message}")]
    RequestFailed { message: String },
    #[error("IO error: {message}")]
    IoError { message: String },
}

struct AppState {
    backend_process: Mutex<Option<Child>>,
    backend_port: u16,
}

impl AppState {
    fn new() -> Self {
        Self {
            backend_process: Mutex::new(None),
            backend_port: 3003,
        }
    }
}

#[tauri::command]
fn get_app_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

#[tauri::command]
fn get_backend_port(state: tauri::State<AppState>) -> u16 {
    state.backend_port
}

async fn find_go_binary(app_handle: &tauri::AppHandle) -> Result<String, String> {
    if let Some(resource_dir) = app_handle.path().resource_dir().ok() {
        let binary_name = if cfg!(windows) {
            "jaicode-server.exe"
        } else {
            "jaicode-server"
        };

        let binary_path = resource_dir.join("backend").join(binary_name);
        if binary_path.exists() {
            return Ok(binary_path.to_string_lossy().to_string());
        }
    }

    if let Ok(path) = which::new("jaicode-server") {
        return Ok(path.to_string_lossy().to_string());
    }

    Ok("jaicode-server".to_string())
}

#[tauri::command]
async fn start_backend(
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
) -> Result<u16, String> {
    let mut process_guard = state.backend_process.lock().unwrap();

    if let Some(ref mut child) = *process_guard {
        if child.try_wait().ok().flatten().is_none() {
            return Ok(state.backend_port);
        }
    }

    let binary_path = find_go_binary(&app_handle).await?;

    let child = Command::new(&binary_path)
        .arg("--port")
        .arg(state.backend_port.to_string())
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start backend: {}", e))?;

    *process_guard = Some(child);
    Ok(state.backend_port)
}

#[tauri::command]
async fn stop_backend(state: tauri::State<'_, AppState>) -> Result<(), String> {
    let mut process_guard = state.backend_process.lock().unwrap();

    if let Some(ref mut child) = *process_guard {
        child.kill().map_err(|e| format!("Failed to stop: {}", e))?;
        child.wait().ok();
        *process_guard = None;
    }

    Ok(())
}

#[tauri::command]
async fn proxy_chat(request: ChatRequest) -> Result<String, AppError> {
    let client = reqwest::Client::new();
    let url = format!("http://localhost:{}/api/chat", 3003);

    let response = client
        .post(&url)
        .json(&request)
        .send()
        .await
        .map_err(|e| AppError::BackendNotRunning)?;

    if !response.status().is_success() {
        return Err(AppError::BackendNotRunning);
    }

    let text = response.text().await.map_err(|e| AppError::RequestFailed {
        message: e.to_string(),
    })?;

    Ok(text)
}

#[tauri::command]
async fn read_file(path: String) -> Result<String, AppError> {
    tokio::fs::read_to_string(&path)
        .await
        .map_err(|e| AppError::IoError {
            message: e.to_string(),
        })
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), AppError> {
    tokio::fs::write(&path, &content)
        .await
        .map_err(|e| AppError::IoError {
            message: e.to_string(),
        })
}

#[tauri::command]
async fn list_directory(path: String) -> Result<Vec<String>, AppError> {
    let mut entries = Vec::new();
    let mut read_dir = tokio::fs::read_dir(&path)
        .await
        .map_err(|e| AppError::IoError {
            message: e.to_string(),
        })?;

    while let Ok(Some(entry)) = read_dir.next_entry().await {
        entries.push(entry.file_name().to_string_lossy().to_string());
    }

    Ok(entries)
}

#[tauri::command]
async fn execute_command(command: String, cwd: String) -> Result<String, AppError> {
    let output = if cfg!(windows) {
        Command::new("cmd").args(&["/C", &command]).current_dir(&cwd).output()
    } else {
        Command::new("sh").arg("-c").arg(&command).current_dir(&cwd).output()
    };

    match output {
        Ok(o) => {
            let stdout = String::from_utf8_lossy(&o.stdout);
            let stderr = String::from_utf8_lossy(&o.stderr);
            Ok(format!("{}{}", stdout, stderr))
        }
        Err(e) => Err(AppError::IoError {
            message: e.to_string(),
        }),
    }
}

#[tauri::command]
async fn check_health() -> Result<bool, String> {
    let client = reqwest::Client::builder().timeout(std::time::Duration::from_secs(5)).build().map_err(|e| e.to_string())?;
    let resp = client.get("http://localhost:3003/api/health").send().await;
    match resp {
        Ok(r) => Ok(r.status().is_success()),
        Err(_) => Ok(false),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
fn main() {
    env_logger::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_global_shortcut::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::init())
        .manage(AppState::new())
        .invoke_handler(tauri::generate_handler![
            get_app_version,
            get_backend_port,
            start_backend,
            stop_backend,
            proxy_chat,
            read_file,
            write_file,
            list_directory,
            execute_command,
            check_health,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().ok();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Jaicode Desktop");
}
