import { drizzle } from "drizzle-orm/sqlite-proxy";
import Database from "@tauri-apps/plugin-sql";
import { invoke } from "@tauri-apps/api/core";
import * as schema from "./schema";

// Cache für die Datenbank-Verbindung
let dbInstance: Database | null = null;

export async function getSqliteDatabase() {
  if (!dbInstance) {
    // Lädt die sqlite.db Datei via Tauri Rust-Backend
    dbInstance = await Database.load("sqlite:sqlite.db");
  }
  return dbInstance;
}

export interface PgConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface ConnectionSettings {
  encryptedConfig: string;
  enabled: boolean;
}

let postgresActive = false;

export function isPostgresActive() {
  return postgresActive;
}

// Die Verbindungsdaten liegen immer in der lokalen SQLite-Datei (verschlüsselt).
export async function loadConnectionSettings(): Promise<ConnectionSettings> {
  const sqlite = await getSqliteDatabase();
  const rows = await sqlite.select<{ encrypted_config: string; enabled: number }[]>(
    "SELECT encrypted_config, enabled FROM connection_settings WHERE id = 1",
  );
  const row = rows[0];
  return {
    encryptedConfig: row?.encrypted_config ?? "",
    enabled: Boolean(row?.enabled),
  };
}

export async function saveConnectionSettings(encryptedConfig: string, enabled: boolean) {
  const sqlite = await getSqliteDatabase();
  await sqlite.execute(
    "INSERT INTO connection_settings (id, encrypted_config, enabled) VALUES (1, $1, $2) " +
      "ON CONFLICT(id) DO UPDATE SET encrypted_config = excluded.encrypted_config, enabled = excluded.enabled",
    [encryptedConfig, enabled ? 1 : 0],
  );
}

// Verbindet beim Start mit PostgreSQL, falls aktiviert. Wirft bei Fehlern (kein stilles Fallback).
export async function initDatabaseBackend() {
  postgresActive = false;
  const settings = await loadConnectionSettings();
  if (settings.enabled && settings.encryptedConfig) {
    await invoke("pg_connect_encrypted", { blob: settings.encryptedConfig });
    postgresActive = true;
  }
}

export async function activatePostgres(
  config: PgConfig,
  options: { importLocalData?: boolean } = {},
): Promise<string> {
  await invoke("pg_connect", { config });
  let importInfo = "";
  if (options.importLocalData) {
    importInfo = await importLocalDataToPostgres();
  }
  const encryptedConfig = await invoke<string>("pg_encrypt_config", { config });
  await saveConnectionSettings(encryptedConfig, true);
  postgresActive = true;
  return importInfo;
}

// Abhängigkeitsreihenfolge (Elterntabellen zuerst)
const IMPORT_TABLES = [
  "planned_routes",
  "clients",
  "Object",
  "products",
  "customer_products",
  "object_products",
  "invoices",
  "invoice_items",
  "settings",
];

async function importLocalDataToPostgres(): Promise<string> {
  for (const table of IMPORT_TABLES) {
    const [[count]] = await invoke<number[][]>("pg_select", {
      sql: `SELECT COUNT(*) FROM "${table}"`,
      values: [],
    });
    if (count > 0) {
      return "Die PostgreSQL-Datenbank enthält bereits Daten, die lokalen Daten wurden nicht übernommen.";
    }
  }

  const sqlite = await getSqliteDatabase();
  let imported = 0;
  try {
    for (const table of IMPORT_TABLES) {
      const rows = await sqlite.select<Record<string, unknown>[]>(`SELECT * FROM "${table}"`);
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
        await invoke("pg_execute", {
          sql: `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(", ")}) VALUES (${placeholders})`,
          values: columns.map((c) => row[c] ?? null),
        });
        imported++;
      }
      await invoke("pg_select", {
        sql:
          `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), ` +
          `COALESCE((SELECT MAX(id) FROM "${table}"), 1), (SELECT COUNT(*) > 0 FROM "${table}"))`,
        values: [],
      });
    }
  } catch (error) {
    for (const table of [...IMPORT_TABLES].reverse()) {
      await invoke("pg_execute", { sql: `DELETE FROM "${table}"`, values: [] }).catch(() => undefined);
    }
    throw new Error(
      `Übernahme der lokalen Daten fehlgeschlagen: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  return `${imported} lokale Datensätze wurden in PostgreSQL übernommen.`;
}

export async function deactivatePostgres() {
  const settings = await loadConnectionSettings();
  await saveConnectionSettings(settings.encryptedConfig, false);
  await invoke("pg_disconnect");
  postgresActive = false;
}

// SQLite nutzt "?", PostgreSQL "$n" (Zeichenketten und Bezeichner bleiben unangetastet).
function toPostgresPlaceholders(sql: string) {
  let result = "";
  let index = 0;
  let quote: string | null = null;
  for (const char of sql) {
    if (quote) {
      if (char === quote) quote = null;
    } else if (char === "'" || char === '"') {
      quote = char;
    } else if (char === "?") {
      result += `$${++index}`;
      continue;
    }
    result += char;
  }
  return result;
}

async function runOnPostgres(sql: string, params: any[], method: string) {
  const pgSql = toPostgresPlaceholders(sql);
  if (method === "run") {
    await invoke("pg_execute", { sql: pgSql, values: params });
    return { rows: [] };
  }
  const rows = await invoke<any[][]>("pg_select", { sql: pgSql, values: params });
  return { rows: method === "all" || method === "values" ? rows : rows[0] };
}

// Initialisiert Drizzle über den Proxy
export const db = drizzle(
  async (sql, params, method) => {
    if (postgresActive) {
      try {
        return await runOnPostgres(sql, params, method);
      } catch (e) {
        console.error("PostgreSQL-Fehler:", e);
        throw e;
      }
    }

    const sqlite = await getSqliteDatabase();
    let rows: any = [];

    try {
      // Wenn es ein INSERT/UPDATE/DELETE (run) ist, nutzen wir execute
      if (method === "run") {
        await sqlite.execute(sql, params);
        return { rows: [] };
      }

      // Ansonsten (SELECT) fragen wir die Daten ab
      rows = await sqlite.select(sql, params);

      // Das Tauri-Plugin gibt ein Array aus Objekten zurück [{id: 1, name: "A"}],
      // Drizzle Proxy erwartet aber ein nacktes Werte-Array [[1, "A"]]
      rows = rows.map((row: any) => Object.values(row));

      // Je nach Methode geben wir alle Ergebnisse (all) oder nur das erste (get) zurück
      const results = method === "all" ? rows : rows[0];
      return { rows: results };
    } catch (e) {
      console.error("Datenbank-Fehler in Tauri:", e);
      return { rows: [] };
    }
  },
  { schema },
);
