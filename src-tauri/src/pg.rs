use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{
    postgres::{PgArguments, PgConnectOptions, PgPoolOptions},
    query::Query,
    Column, Executor, PgPool, Postgres, Row, TypeInfo,
};
use std::time::Duration;
use tauri::State;

const KEYRING_SERVICE: &str = "easy-bill";
const KEYRING_USER: &str = "connection-settings-key";
const BLOB_PREFIX: &str = "v1:";

#[derive(Default)]
pub struct PgState(pub tauri::async_runtime::Mutex<Option<PgPool>>);

#[derive(Serialize, Deserialize, Clone)]
pub struct PgConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub username: String,
    #[serde(default)]
    pub password: String,
}

fn load_or_create_key() -> Result<[u8; 32], String> {
    let entry = keyring::Entry::new(KEYRING_SERVICE, KEYRING_USER)
        .map_err(|e| format!("Schlüsselspeicher nicht verfügbar: {e}"))?;

    match entry.get_password() {
        Ok(encoded) => {
            let bytes = STANDARD
                .decode(encoded.trim())
                .map_err(|e| format!("Gespeicherter Schlüssel ist ungültig: {e}"))?;
            bytes
                .try_into()
                .map_err(|_| "Gespeicherter Schlüssel hat eine falsche Länge.".to_string())
        }
        Err(keyring::Error::NoEntry) => {
            let key = Aes256Gcm::generate_key(OsRng);
            entry
                .set_password(&STANDARD.encode(key))
                .map_err(|e| format!("Schlüssel konnte nicht gespeichert werden: {e}"))?;
            Ok(key.into())
        }
        Err(e) => Err(format!("Schlüsselspeicher nicht lesbar: {e}")),
    }
}

fn encrypt_config(config: &PgConfig) -> Result<String, String> {
    let key = load_or_create_key()?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let plaintext = serde_json::to_vec(config).map_err(|e| e.to_string())?;
    let ciphertext = cipher
        .encrypt(&nonce, plaintext.as_ref())
        .map_err(|_| "Verschlüsselung fehlgeschlagen.".to_string())?;

    let mut payload = nonce.to_vec();
    payload.extend(ciphertext);
    Ok(format!("{BLOB_PREFIX}{}", STANDARD.encode(payload)))
}

fn decrypt_config(blob: &str) -> Result<PgConfig, String> {
    let encoded = blob
        .strip_prefix(BLOB_PREFIX)
        .ok_or("Unbekanntes Format der gespeicherten Verbindungsdaten.")?;
    let payload = STANDARD
        .decode(encoded)
        .map_err(|e| format!("Verbindungsdaten beschädigt: {e}"))?;
    if payload.len() < 13 {
        return Err("Verbindungsdaten beschädigt.".into());
    }

    let key = load_or_create_key()?;
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(&key));
    let (nonce, ciphertext) = payload.split_at(12);
    let plaintext = cipher
        .decrypt(Nonce::from_slice(nonce), ciphertext)
        .map_err(|_| {
            "Verbindungsdaten konnten nicht entschlüsselt werden (anderer Schlüssel oder Rechner?)."
                .to_string()
        })?;
    serde_json::from_slice(&plaintext).map_err(|e| e.to_string())
}

async fn open_pool(config: &PgConfig) -> Result<PgPool, String> {
    let options = PgConnectOptions::new()
        .host(&config.host)
        .port(config.port)
        .database(&config.database)
        .username(&config.username)
        .password(&config.password);

    let pool = PgPoolOptions::new()
        .max_connections(4)
        .acquire_timeout(Duration::from_secs(8))
        .connect_with(options)
        .await
        .map_err(|e| format!("Verbindung oder Anmeldung fehlgeschlagen: {e}"))?;

    sqlx::raw_sql(include_str!("pg_schema.sql"))
        .execute(&pool)
        .await
        .map_err(|e| format!("Datenbankschema konnte nicht angelegt werden: {e}"))?;

    Ok(pool)
}

async fn activate(state: &State<'_, PgState>, config: &PgConfig) -> Result<(), String> {
    let pool = open_pool(config).await?;
    let mut guard = state.0.lock().await;
    if let Some(old) = guard.replace(pool) {
        old.close().await;
    }
    Ok(())
}

#[tauri::command]
pub async fn pg_encrypt_config(config: PgConfig) -> Result<String, String> {
    encrypt_config(&config)
}

// Liefert die Verbindungsdaten ohne Passwort, damit sie im Formular angezeigt werden können.
#[tauri::command]
pub fn pg_describe_config(blob: String) -> Result<PgConfig, String> {
    let mut config = decrypt_config(&blob)?;
    config.password.clear();
    Ok(config)
}

#[tauri::command]
pub async fn pg_connect(state: State<'_, PgState>, config: PgConfig) -> Result<(), String> {
    activate(&state, &config).await
}

#[tauri::command]
pub async fn pg_connect_encrypted(state: State<'_, PgState>, blob: String) -> Result<(), String> {
    let config = decrypt_config(&blob)?;
    activate(&state, &config).await
}

#[tauri::command]
pub async fn pg_disconnect(state: State<'_, PgState>) -> Result<(), String> {
    if let Some(pool) = state.0.lock().await.take() {
        pool.close().await;
    }
    Ok(())
}

async fn current_pool(state: &State<'_, PgState>) -> Result<PgPool, String> {
    state
        .0
        .lock()
        .await
        .clone()
        .ok_or_else(|| "Keine PostgreSQL-Verbindung aktiv.".to_string())
}

fn as_i64(value: &Value) -> Result<Option<i64>, String> {
    match value {
        Value::Null => Ok(None),
        Value::Bool(b) => Ok(Some(*b as i64)),
        Value::Number(n) => n
            .as_i64()
            .or_else(|| n.as_f64().map(|f| f as i64))
            .map(Some)
            .ok_or_else(|| "Zahl außerhalb des Wertebereichs".to_string()),
        Value::String(s) => s
            .trim()
            .parse::<i64>()
            .map(Some)
            .map_err(|_| format!("'{s}' ist keine ganze Zahl")),
        _ => Err("Ungültiger Wert für ganzzahlige Spalte".into()),
    }
}

fn as_f64(value: &Value) -> Result<Option<f64>, String> {
    match value {
        Value::Null => Ok(None),
        Value::Bool(b) => Ok(Some(*b as i64 as f64)),
        Value::Number(n) => Ok(n.as_f64()),
        Value::String(s) => s
            .trim()
            .parse::<f64>()
            .map(Some)
            .map_err(|_| format!("'{s}' ist keine Zahl")),
        _ => Err("Ungültiger Wert für Zahlenspalte".into()),
    }
}

fn as_bool(value: &Value) -> Result<Option<bool>, String> {
    match value {
        Value::Null => Ok(None),
        Value::Bool(b) => Ok(Some(*b)),
        Value::Number(n) => Ok(Some(n.as_f64().unwrap_or(0.0) != 0.0)),
        Value::String(s) => Ok(Some(matches!(s.as_str(), "1" | "true" | "t"))),
        _ => Err("Ungültiger Wert für Boolean-Spalte".into()),
    }
}

fn as_text(value: &Value) -> Option<String> {
    match value {
        Value::Null => None,
        Value::String(s) => Some(s.clone()),
        other => Some(other.to_string()),
    }
}

fn guess_type(value: &Value) -> &'static str {
    match value {
        Value::Number(n) if n.is_i64() || n.is_u64() => "INT8",
        Value::Number(_) => "FLOAT8",
        Value::Bool(_) => "BOOL",
        _ => "TEXT",
    }
}

fn bind_value<'q>(
    query: Query<'q, Postgres, PgArguments>,
    type_name: &str,
    value: &Value,
) -> Result<Query<'q, Postgres, PgArguments>, String> {
    Ok(match type_name {
        "INT2" => query.bind(as_i64(value)?.map(|n| n as i16)),
        "INT4" => query.bind(as_i64(value)?.map(|n| n as i32)),
        "INT8" => query.bind(as_i64(value)?),
        "FLOAT4" => query.bind(as_f64(value)?.map(|n| n as f32)),
        "FLOAT8" => query.bind(as_f64(value)?),
        "BOOL" => query.bind(as_bool(value)?),
        "TEXT" | "VARCHAR" | "BPCHAR" | "NAME" | "UNKNOWN" => query.bind(as_text(value)),
        other => return Err(format!("Nicht unterstützter Parametertyp: {other}")),
    })
}

async fn bind_all<'q>(
    pool: &PgPool,
    sql: &'q str,
    values: &[Value],
) -> Result<Query<'q, Postgres, PgArguments>, String> {
    let described = pool
        .describe(sql)
        .await
        .map_err(|e| format!("SQL-Fehler: {e}"))?;
    let declared: Option<Vec<String>> = match described.parameters() {
        Some(sqlx::Either::Left(types)) => {
            Some(types.iter().map(|t| t.name().to_string()).collect())
        }
        _ => None,
    };

    let mut query = sqlx::query(sql);
    for (index, value) in values.iter().enumerate() {
        let type_name = declared
            .as_ref()
            .and_then(|types| types.get(index).cloned())
            .unwrap_or_else(|| guess_type(value).to_string());
        query = bind_value(query, &type_name, value)?;
    }
    Ok(query)
}

#[tauri::command]
pub async fn pg_execute(
    state: State<'_, PgState>,
    sql: String,
    values: Vec<Value>,
) -> Result<u64, String> {
    let pool = current_pool(&state).await?;
    let query = bind_all(&pool, &sql, &values).await?;
    let result = query
        .execute(&pool)
        .await
        .map_err(|e| format!("SQL-Fehler: {e}"))?;
    Ok(result.rows_affected())
}

fn decode_cell(row: &sqlx::postgres::PgRow, index: usize) -> Result<Value, String> {
    let type_name = row.column(index).type_info().name().to_string();
    let err = |e: sqlx::Error| format!("Spalte {index} ({type_name}): {e}");

    Ok(match type_name.as_str() {
        "INT2" => row
            .try_get::<Option<i16>, _>(index)
            .map_err(err)?
            .map_or(Value::Null, |v| Value::from(v)),
        "INT4" => row
            .try_get::<Option<i32>, _>(index)
            .map_err(err)?
            .map_or(Value::Null, |v| Value::from(v)),
        "INT8" => row
            .try_get::<Option<i64>, _>(index)
            .map_err(err)?
            .map_or(Value::Null, |v| Value::from(v)),
        "FLOAT4" => row
            .try_get::<Option<f32>, _>(index)
            .map_err(err)?
            .map_or(Value::Null, |v| Value::from(v as f64)),
        "FLOAT8" => row
            .try_get::<Option<f64>, _>(index)
            .map_err(err)?
            .map_or(Value::Null, |v| Value::from(v)),
        "BOOL" => row
            .try_get::<Option<bool>, _>(index)
            .map_err(err)?
            .map_or(Value::Null, |v| Value::from(v)),
        "TEXT" | "VARCHAR" | "BPCHAR" | "NAME" | "CHAR" => row
            .try_get::<Option<String>, _>(index)
            .map_err(err)?
            .map_or(Value::Null, Value::from),
        other => return Err(format!("Nicht unterstützter Spaltentyp: {other}")),
    })
}

#[tauri::command]
pub async fn pg_select(
    state: State<'_, PgState>,
    sql: String,
    values: Vec<Value>,
) -> Result<Vec<Vec<Value>>, String> {
    let pool = current_pool(&state).await?;
    let query = bind_all(&pool, &sql, &values).await?;
    let rows = query
        .fetch_all(&pool)
        .await
        .map_err(|e| format!("SQL-Fehler: {e}"))?;

    rows.iter()
        .map(|row| {
            (0..row.columns().len())
                .map(|index| decode_cell(row, index))
                .collect::<Result<Vec<_>, _>>()
        })
        .collect()
}
