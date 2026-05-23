use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
struct SupportedFileEntry {
  name: String,
  path: String,
}

fn is_supported_text_file(path: &Path) -> bool {
  path
    .extension()
    .and_then(|ext| ext.to_str())
    .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "md" | "markdown" | "txt"))
    .unwrap_or(false)
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
  path
    .file_name()
    .and_then(|name| name.to_str())
    .unwrap_or_default()
    .to_string()
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
  tauri::Builder::default()
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
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      reveal_in_folder,
      read_text_document,
      write_text_document,
      document_exists,
      list_supported_documents
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
