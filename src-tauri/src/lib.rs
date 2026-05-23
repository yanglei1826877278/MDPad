use std::path::Path;
use std::process::Command;

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
    .invoke_handler(tauri::generate_handler![reveal_in_folder])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
