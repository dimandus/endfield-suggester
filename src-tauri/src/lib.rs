use serde::Serialize;
use serde_json::{json, Value};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::Manager;

const PORTRAIT_FILES: &[&str] = &[
    "portrait.png",
    "portrait.jpg",
    "portrait.jpeg",
    "icon.png",
    "icon.jpg",
    "icon.jpeg",
];

const ICON_FILES: &[&str] = &[
    "icon.png",
    "icon.jpg",
    "icon.jpeg",
    "portrait.png",
    "portrait.jpg",
    "portrait.jpeg",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Entity {
    id: String,
    folder: String,
    info: Value,
    portrait_path: Option<String>,
    icon_path: Option<String>,
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Library {
    data_dir: String,
    tags: Vec<String>,
    operators: Vec<Entity>,
    weapons: Vec<Entity>,
}

const DEFAULT_TAGS: &str = "\
# Общий список тегов для оружия и навыков персонажей.\r\n\
# Одна строка — один тег. Пустые строки и строки с # игнорируются.\r\n\
Последний удар\r\n\
Уклонение\r\n\
Очки навыков\r\n\
Комбонавык\r\n\
Боевой навык\r\n\
Супер навык\r\n\
Ошеломление\r\n\
Добивание\r\n\
Подбрасывание\r\n\
Опрокидывание\r\n\
Разгром\r\n\
Прорыв\r\n\
Физическое состояние\r\n\
Уязвимость\r\n\
Поражение искусствами\r\n\
Тепло\r\n\
Электро\r\n\
Крио\r\n\
Природа\r\n\
Тепловзрыв\r\n\
Возгорание\r\n\
Электровзрыв\r\n\
Электризация\r\n\
Криовзрыв\r\n\
Застывание\r\n\
Природный взрыв\r\n\
Коррозия\r\n\
Реакция искусств\r\n\
Щит\r\n";

fn resolve_data_dir() -> Result<PathBuf, String> {
    if cfg!(debug_assertions) {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        let root = manifest
            .parent()
            .ok_or_else(|| "Не удалось найти корень проекта".to_string())?;
        return Ok(root.join("data"));
    }

    let exe = std::env::current_exe().map_err(|e| e.to_string())?;
    let exe_dir = exe
        .parent()
        .ok_or_else(|| "Не удалось найти папку программы".to_string())?;
    Ok(exe_dir.join("data"))
}

fn first_file(dir: &Path, names: &[&str]) -> Option<PathBuf> {
    names
        .iter()
        .map(|name| dir.join(name))
        .find(|path| path.is_file())
}

fn scan_kind(root: &Path, kind: &str) -> Vec<Entity> {
    let kind_dir = root.join(kind);
    let Ok(entries) = fs::read_dir(&kind_dir) else {
        return Vec::new();
    };

    let mut entities: Vec<Entity> = entries
        .flatten()
        .filter(|entry| entry.path().is_dir())
        .map(|entry| {
            let folder = entry.path();
            let id = folder
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("unknown")
                .to_string();
            let info_path = folder.join("info.json");
            let (mut info, error) = match fs::read_to_string(&info_path) {
                Ok(raw) => match serde_json::from_str::<Value>(&raw) {
                    Ok(value) => (value, None),
                    Err(err) => (json!({}), Some(format!("Некорректный info.json: {err}"))),
                },
                Err(_) => (json!({}), Some("Нет файла info.json".to_string())),
            };

            if let Some(object) = info.as_object_mut() {
                object.entry("id").or_insert(json!(id.clone()));
            }

            Entity {
                id,
                folder: folder.display().to_string(),
                info,
                portrait_path: first_file(&folder, PORTRAIT_FILES)
                    .map(|path| path.display().to_string()),
                icon_path: first_file(&folder, ICON_FILES).map(|path| path.display().to_string()),
                error,
            }
        })
        .collect();

    entities.sort_by(|a, b| {
        let name_a = a.info.get("name").and_then(Value::as_str).unwrap_or(&a.id);
        let name_b = b.info.get("name").and_then(Value::as_str).unwrap_or(&b.id);
        name_a.cmp(name_b)
    });
    entities
}

fn tags_path(data_dir: &Path) -> PathBuf {
    data_dir.join("tags.txt")
}

fn parse_tags(raw: &str) -> Vec<String> {
    let text = raw.trim_start_matches('\u{feff}');
    let mut tags = Vec::new();
    for line in text.lines() {
        let tag = line.trim();
        if tag.is_empty() || tag.starts_with('#') {
            continue;
        }
        if !tags.iter().any(|existing| existing == tag) {
            tags.push(tag.to_string());
        }
    }
    tags
}

fn load_tags(data_dir: &Path) -> Result<Vec<String>, String> {
    let path = tags_path(data_dir);
    if !path.exists() {
        let mut body = String::from('\u{feff}');
        body.push_str(DEFAULT_TAGS);
        fs::write(&path, body).map_err(|e| e.to_string())?;
    }
    let raw = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(parse_tags(&raw))
}

fn ensure_data_layout(data_dir: &Path) -> Result<(), String> {
    fs::create_dir_all(data_dir.join("operators")).map_err(|e| e.to_string())?;
    fs::create_dir_all(data_dir.join("weapons")).map_err(|e| e.to_string())?;
    load_tags(data_dir)?;
    Ok(())
}

fn kind_dir_name(kind: &str) -> Result<&str, String> {
    match kind {
        "operators" | "weapons" => Ok(kind),
        _ => Err("Можно сохранять только operators или weapons".into()),
    }
}

fn folder_id(id: &str) -> Result<String, String> {
    let name = Path::new(id)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");
    if name.is_empty() || name != id || name == "." || name == ".." {
        return Err("Некорректный id папки".into());
    }
    Ok(name.to_string())
}

fn transliterate(ch: char) -> String {
    match ch {
        'а' | 'А' => "a".into(),
        'б' | 'Б' => "b".into(),
        'в' | 'В' => "v".into(),
        'г' | 'Г' => "g".into(),
        'д' | 'Д' => "d".into(),
        'е' | 'Е' | 'ё' | 'Ё' => "e".into(),
        'ж' | 'Ж' => "zh".into(),
        'з' | 'З' => "z".into(),
        'и' | 'И' => "i".into(),
        'й' | 'Й' => "y".into(),
        'к' | 'К' => "k".into(),
        'л' | 'Л' => "l".into(),
        'м' | 'М' => "m".into(),
        'н' | 'Н' => "n".into(),
        'о' | 'О' => "o".into(),
        'п' | 'П' => "p".into(),
        'р' | 'Р' => "r".into(),
        'с' | 'С' => "s".into(),
        'т' | 'Т' => "t".into(),
        'у' | 'У' => "u".into(),
        'ф' | 'Ф' => "f".into(),
        'х' | 'Х' => "h".into(),
        'ц' | 'Ц' => "ts".into(),
        'ч' | 'Ч' => "ch".into(),
        'ш' | 'Ш' => "sh".into(),
        'щ' | 'Щ' => "sch".into(),
        'ы' | 'Ы' => "y".into(),
        'э' | 'Э' => "e".into(),
        'ю' | 'Ю' => "yu".into(),
        'я' | 'Я' => "ya".into(),
        'ъ' | 'Ъ' | 'ь' | 'Ь' => "".into(),
        other => other.to_string(),
    }
}

fn slugify(name: &str) -> String {
    let mut slug = String::new();
    for ch in name.chars() {
        let mapped = transliterate(ch).to_lowercase();
        for piece in mapped.chars() {
            if piece.is_ascii_alphanumeric() {
                slug.push(piece);
            } else if piece == ' ' || piece == '_' || piece == '-' {
                if !slug.ends_with('-') {
                    slug.push('-');
                }
            }
        }
    }
    let slug = slug.trim_matches('-').to_string();
    if slug.is_empty() {
        "item".into()
    } else {
        slug
    }
}

fn unique_slug(kind_dir: &Path, name: &str) -> String {
    let base = slugify(name);
    let mut candidate = base.clone();
    let mut index = 2;
    while kind_dir.join(&candidate).exists() {
        candidate = format!("{base}-{index}");
        index += 1;
    }
    candidate
}

fn write_info(folder: &Path, info: &Value) -> Result<(), String> {
    fs::create_dir_all(folder).map_err(|e| e.to_string())?;
    let mut body = serde_json::to_string_pretty(info).map_err(|e| e.to_string())?;
    if !body.ends_with('\n') {
        body.push('\n');
    }
    fs::write(folder.join("info.json"), body).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_library(app: tauri::AppHandle) -> Result<Library, String> {
    let data_dir = resolve_data_dir()?;
    ensure_data_layout(&data_dir)?;
    app.asset_protocol_scope()
        .allow_directory(&data_dir, true)
        .map_err(|e| e.to_string())?;

    Ok(Library {
        data_dir: data_dir.display().to_string(),
        tags: load_tags(&data_dir)?,
        operators: scan_kind(&data_dir, "operators"),
        weapons: scan_kind(&data_dir, "weapons"),
    })
}

#[tauri::command]
fn open_tags_file() -> Result<String, String> {
    let data_dir = resolve_data_dir()?;
    ensure_data_layout(&data_dir)?;
    let path = tags_path(&data_dir);

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("notepad")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(path.display().to_string())
}

#[tauri::command]
fn open_data_dir() -> Result<String, String> {
    let data_dir = resolve_data_dir()?;
    ensure_data_layout(&data_dir)?;

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(data_dir.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("open")
            .arg(data_dir.as_os_str())
            .spawn()
            .map_err(|e| e.to_string())?;
    }

    Ok(data_dir.display().to_string())
}

#[tauri::command]
fn save_entity(kind: String, id: Option<String>, info: Value) -> Result<String, String> {
    let kind = kind_dir_name(&kind)?;
    let data_dir = resolve_data_dir()?;
    ensure_data_layout(&data_dir)?;
    let kind_dir = data_dir.join(kind);
    let name = info
        .get("name")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| "Укажите имя".to_string())?;

    let is_new = id.is_none();
    let folder_name = match id.as_deref() {
        Some(existing) => folder_id(existing)?,
        None => unique_slug(&kind_dir, name),
    };
    let folder = kind_dir.join(&folder_name);
    if is_new && folder.exists() {
        return Err("Такая папка уже есть".into());
    }

    let mut stored = info;
    if let Some(object) = stored.as_object_mut() {
        object.remove("id");
        object.remove("nameRu");
    }
    write_info(&folder, &stored)?;
    Ok(folder_name)
}

#[tauri::command]
fn delete_entity(kind: String, id: String) -> Result<(), String> {
    let kind = kind_dir_name(&kind)?;
    let id = folder_id(&id)?;
    let folder = resolve_data_dir()?.join(kind).join(id);
    if !folder.is_dir() {
        return Err("Папка не найдена".into());
    }
    fs::remove_dir_all(folder).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Ok(data_dir) = resolve_data_dir() {
                let _ = ensure_data_layout(&data_dir);
                let _ = app.asset_protocol_scope().allow_directory(&data_dir, true);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_library,
            open_data_dir,
            open_tags_file,
            save_entity,
            delete_entity
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
