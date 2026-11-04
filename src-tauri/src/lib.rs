use tauri_plugin_sql::{Migration, MigrationKind};

/// Connection string used by both the Rust side (migrations) and the
/// frontend (`src/db/client.ts`). The file lives in the app's config folder,
/// e.g. `%APPDATA%\com.ognjen.gamebacklog\backlog.db` on Windows.
const DB_URL: &str = "sqlite:backlog.db";

fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create settings and games",
            sql: include_str!("../migrations/0001_initial.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "add platform to games",
            sql: include_str!("../migrations/0002_platform.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add paused status",
            sql: include_str!("../migrations/0003_paused_status.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
