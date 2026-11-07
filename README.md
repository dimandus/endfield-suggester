# Endfield Suggester

Подбор оружия и команд для Arknights: Endfield. Данные живут обычными папками Windows, не в SQL.

## Запуск

Нужны Node.js, Rust (`rustup`) и Visual Studio Build Tools с workload **Desktop development with C++**.

```
npm install
dev.bat
```

`dev.bat` поднимает MSVC-окружение и запускает `npm run tauri dev`.

## База данных

Папка `data/` рядом с проектом (в собранном `.exe` — рядом с программой).

- `data/operators/<id>/info.json` + `portrait.png` / `icon.png`
- `data/weapons/<id>/info.json` + картинки
- Инструкция: `data/README.txt`
- Схемы полей: `data/_schema/`

Добавить оперативника: скопировать папку, переименовать, поправить `info.json`, нажать «Обновить» в приложении.
