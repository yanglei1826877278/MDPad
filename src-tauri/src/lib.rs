use base64::prelude::*;
use serde::Serialize;
use std::ffi::OsString;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{Emitter, Manager};

const OPEN_DOCUMENTS_EVENT: &str = "open-documents";
const OPEN_DOCUMENTS_LOG_FILE: &str = "mdpad-open-args.log";

#[derive(Serialize)]
struct SupportedFileEntry {
    name: String,
    path: String,
}

#[derive(Default)]
struct PendingOpenDocuments {
    paths: Mutex<Vec<String>>,
}

#[derive(Clone, Serialize)]
struct OpenDocumentsPayload {
    paths: Vec<String>,
}

fn is_supported_text_file(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "md" | "markdown" | "txt"))
        .unwrap_or(false)
}

fn supported_image_mime(path: &Path) -> Option<&'static str> {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => Some("image/png"),
        Some("jpg") | Some("jpeg") => Some("image/jpeg"),
        Some("gif") => Some("image/gif"),
        Some("webp") => Some("image/webp"),
        Some("bmp") => Some("image/bmp"),
        Some("svg") => Some("image/svg+xml"),
        Some("ico") => Some("image/x-icon"),
        _ => None,
    }
}

fn extension_order(path: &Path) -> u8 {
    match path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())
        .as_deref()
    {
        Some("md") => 0,
        Some("markdown") => 1,
        Some("txt") => 2,
        _ => 3,
    }
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default()
        .to_string()
}

fn write_open_documents_log(stage: &str, args: &[String], paths: &[String]) {
    if std::env::var_os("MDPAD_LOG_OPEN_ARGS").is_none() {
        return;
    }

    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default();
    let log_path = std::env::temp_dir().join(OPEN_DOCUMENTS_LOG_FILE);

    if let Ok(mut file) = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_path)
    {
        let _ = writeln!(file, "[{}] {}", timestamp, stage);
        let _ = writeln!(file, "args: {:?}", args);
        let _ = writeln!(file, "paths: {:?}", paths);
    }
}

fn absolute_path(path: PathBuf, base_dir: Option<&Path>) -> PathBuf {
    if path.is_absolute() {
        return path;
    }

    if let Some(base_dir) = base_dir {
        return base_dir.join(path);
    }

    std::env::current_dir()
        .map(|current_dir| current_dir.join(&path))
        .unwrap_or(path)
}

fn path_from_open_arg(arg: OsString, base_dir: Option<&Path>) -> Option<PathBuf> {
    let raw_arg = arg.to_string_lossy();
    let trimmed_arg = raw_arg.trim().trim_matches('"');

    if trimmed_arg.is_empty() {
        return None;
    }

    if trimmed_arg.starts_with("file://") {
        return tauri::Url::parse(trimmed_arg)
            .ok()
            .and_then(|url| url.to_file_path().ok());
    }

    Some(absolute_path(PathBuf::from(trimmed_arg), base_dir))
}

fn supported_document_path(path: PathBuf) -> Option<String> {
    if is_supported_text_file(&path) {
        Some(path.to_string_lossy().into_owned())
    } else {
        None
    }
}

fn open_document_from_arg(arg: OsString, base_dir: Option<&Path>) -> Option<String> {
    path_from_open_arg(arg, base_dir).and_then(supported_document_path)
}

#[cfg(target_os = "macos")]
fn open_document_from_url(url: tauri::Url) -> Option<String> {
    if url.scheme() == "file" {
        url.to_file_path().ok().and_then(supported_document_path)
    } else {
        None
    }
}

fn dedupe_paths(paths: Vec<String>) -> Vec<String> {
    let mut unique_paths = Vec::new();

    for path in paths {
        if !unique_paths
            .iter()
            .any(|existing_path| existing_path == &path)
        {
            unique_paths.push(path);
        }
    }

    unique_paths
}

fn open_documents_from_args<I, P>(args: I, base_dir: Option<&Path>) -> Vec<String>
where
    I: IntoIterator<Item = P>,
    P: Into<OsString>,
{
    let args = args
        .into_iter()
        .map(|arg| arg.into())
        .collect::<Vec<OsString>>();
    let raw_args = args
        .iter()
        .map(|arg| arg.to_string_lossy().into_owned())
        .collect::<Vec<_>>();
    let paths = dedupe_paths(
        args.into_iter()
            .filter_map(|arg| open_document_from_arg(arg, base_dir))
            .collect(),
    );

    write_open_documents_log("parse-args", &raw_args, &paths);
    paths
}

fn initial_open_documents() -> Vec<String> {
    open_documents_from_args(std::env::args_os().skip(1), None)
}

#[cfg(target_os = "macos")]
fn open_documents_from_urls(urls: Vec<tauri::Url>) -> Vec<String> {
    dedupe_paths(
        urls.into_iter()
            .filter_map(open_document_from_url)
            .collect(),
    )
}

fn queue_open_documents(app: &tauri::AppHandle, paths: Vec<String>) {
    let paths = dedupe_paths(paths);

    if paths.is_empty() {
        return;
    }

    {
        let pending_documents = app.state::<PendingOpenDocuments>();
        let mut pending_paths = pending_documents.paths.lock().unwrap();

        for path in &paths {
            if !pending_paths
                .iter()
                .any(|pending_path| pending_path == path)
            {
                pending_paths.push(path.clone());
            }
        }
    }

    let _ = app.emit(
        OPEN_DOCUMENTS_EVENT,
        OpenDocumentsPayload {
            paths: paths.clone(),
        },
    );

    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[tauri::command]
fn read_text_document(path: String) -> Result<String, String> {
    let target = Path::new(&path);

    if !is_supported_text_file(target) {
        return Err("暂不支持该文件类型，仅支持 .md、.markdown、.txt。".into());
    }

    fs::read_to_string(target).map_err(|err| err.to_string())
}

#[tauri::command]
fn read_local_image_data_url(path: String) -> Result<String, String> {
    let target = Path::new(&path);
    let mime = supported_image_mime(target).ok_or("暂不支持该图片类型。")?;
    let bytes = fs::read(target).map_err(|err| err.to_string())?;
    let encoded = BASE64_STANDARD.encode(bytes);

    Ok(format!("data:{};base64,{}", mime, encoded))
}

#[tauri::command]
fn write_text_document(path: String, content: String) -> Result<(), String> {
    let target = Path::new(&path);

    if !is_supported_text_file(target) {
        return Err("暂不支持该文件类型，仅支持 .md、.markdown、.txt。".into());
    }

    fs::write(target, content).map_err(|err| err.to_string())
}

#[tauri::command]
fn document_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn take_pending_open_documents(
    pending_documents: tauri::State<'_, PendingOpenDocuments>,
) -> Vec<String> {
    let mut pending_paths = pending_documents.paths.lock().unwrap();
    std::mem::take(&mut *pending_paths)
}

#[tauri::command]
fn list_supported_documents(path: String) -> Result<Vec<SupportedFileEntry>, String> {
    let dir = Path::new(&path);
    let mut files = fs::read_dir(dir)
        .map_err(|err| err.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let entry_path = entry.path();
            let file_type = entry.file_type().ok()?;

            if !file_type.is_file() || !is_supported_text_file(&entry_path) {
                return None;
            }

            Some(SupportedFileEntry {
                name: file_name(&entry_path),
                path: entry_path.to_string_lossy().into_owned(),
            })
        })
        .collect::<Vec<_>>();

    files.sort_by(|a, b| {
        let path_a = Path::new(&a.path);
        let path_b = Path::new(&b.path);
        extension_order(path_a)
            .cmp(&extension_order(path_b))
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(files)
}

#[tauri::command]
fn reveal_in_folder(path: String) -> Result<(), String> {
    let target = Path::new(&path);
    let parent = target.parent().unwrap_or(target);

    #[cfg(target_os = "windows")]
    {
        let status = if target.exists() {
            Command::new("explorer")
                .arg(format!("/select,{}", path))
                .status()
        } else {
            Command::new("explorer").arg(parent).status()
        }
        .map_err(|err| err.to_string())?;

        if status.success() {
            return Ok(());
        }

        return Err("无法打开资源管理器。".into());
    }

    #[cfg(target_os = "macos")]
    {
        let status = if target.exists() {
            Command::new("open").arg("-R").arg(&path).status()
        } else {
            Command::new("open").arg(parent).status()
        }
        .map_err(|err| err.to_string())?;

        if status.success() {
            return Ok(());
        }

        return Err("无法在 Finder 中显示目标。".into());
    }

    #[cfg(all(unix, not(target_os = "macos")))]
    {
        let status = Command::new("xdg-open")
            .arg(parent)
            .status()
            .map_err(|err| err.to_string())?;

        if status.success() {
            return Ok(());
        }

        return Err("无法打开目标文件夹。".into());
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .manage(PendingOpenDocuments::default())
        .plugin(tauri_plugin_single_instance::init(|app, argv, cwd| {
            queue_open_documents(app, open_documents_from_args(argv, Some(Path::new(&cwd))));
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            queue_open_documents(app.handle(), initial_open_documents());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            reveal_in_folder,
            read_text_document,
            read_local_image_data_url,
            write_text_document,
            document_exists,
            take_pending_open_documents,
            list_supported_documents
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            queue_open_documents(app_handle, open_documents_from_urls(urls));
        }

        #[cfg(not(target_os = "macos"))]
        {
            let _ = (app_handle, event);
        }
    });
}
