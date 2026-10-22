// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
async fn test_postgres_connection(
    host: String,
    port: u16,
    database: String,
    username: String,
    password: String,
) -> Result<(), String> {
    use sqlx::postgres::{PgConnectOptions, PgPoolOptions};
    use std::time::Duration;

    let options = PgConnectOptions::new()
        .host(&host)
        .port(port)
        .database(&database)
        .username(&username)
        .password(&password);

    let pool = PgPoolOptions::new()
        .max_connections(1)
        .acquire_timeout(Duration::from_secs(8))
        .connect_with(options)
        .await
        .map_err(|error| format!("Verbindung oder Anmeldung fehlgeschlagen: {error}"))?;

    let query_result = sqlx::query_scalar::<_, i32>("SELECT 1")
        .fetch_one(&pool)
        .await;
    pool.close().await;

    match query_result {
        Ok(1) => Ok(()),
        Ok(_) => Err("Der PostgreSQL-Server lieferte ein unerwartetes Ergebnis.".into()),
        Err(error) => Err(format!("SQL-Testabfrage fehlgeschlagen: {error}")),
    }
}

mod license;
mod machine_id;
mod pg;

use tauri_plugin_sql::{Migration, MigrationKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let migrations = vec![
        Migration {
            version: 1,
            description: "create_initial_tables",
            sql: include_str!("../../drizzle/0000_superb_doctor_doom.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_customer_products",
            sql: include_str!("../../drizzle/0001_create_customer_products.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "add_product_units",
            sql: include_str!("../../drizzle/0002_add_product_units.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_customer_product_quantity",
            sql: include_str!("../../drizzle/0003_add_customer_product_quantity.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 5,
            description: "add_settings_table",
            sql: include_str!("../../drizzle/0004_add_settings_table.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 6,
            description: "add_logo_path",
            sql: include_str!("../../drizzle/0005_add_logo_path.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 7,
            description: "create_object_products",
            sql: include_str!("../../drizzle/0006_create_object_products.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 8,
            description: "add_invoice_total",
            sql: include_str!("../../drizzle/0007_add_invoice_total.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 9,
            description: "add_invoice_number",
            sql: include_str!("../../drizzle/0008_add_invoice_number.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 10,
            description: "snapshot_invoice_item_products",
            sql: include_str!("../../drizzle/0009_snapshot_invoice_item_products.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 11,
            description: "add_invoice_status",
            sql: include_str!("../../drizzle/0010_add_invoice_status.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 12,
            description: "add_invoice_price_breakdown",
            sql: include_str!("../../drizzle/0011_add_invoice_price_breakdown.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 13,
            description: "add_invoice_dates",
            sql: include_str!("../../drizzle/0012_add_invoice_dates.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 14,
            description: "add_seller_payment_details",
            sql: include_str!("../../drizzle/0013_add_seller_payment_details.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 15,
            description: "add_connection_settings",
            sql: include_str!("../../drizzle/0014_add_connection_settings.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 16,
            description: "add_license_settings",
            sql: include_str!("../../drizzle/0015_add_license_settings.sql"),
            kind: MigrationKind::Up,
        },
    ];

    tauri::Builder::default()
        .manage(pg::PgState::default())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations("sqlite:sqlite.db", migrations)
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            greet,
            test_postgres_connection,
            pg::pg_encrypt_config,
            pg::pg_describe_config,
            pg::pg_connect,
            pg::pg_connect_encrypted,
            pg::pg_disconnect,
            pg::pg_execute,
            pg::pg_select,
            license::license_startup,
            license::license_start_trial,
            license::license_request_code,
            license::license_activate,
            license::license_deactivate,
            license::license_open_page
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
