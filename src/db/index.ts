import { drizzle } from "drizzle-orm/sqlite-proxy";
import Database from "@tauri-apps/plugin-sql";
import * as schema from "./schema";

// Cache für die Datenbank-Verbindung
let dbInstance: Database | null = null;

async function getDb() {
  if (!dbInstance) {
    // Lädt die sqlite.db Datei via Tauri Rust-Backend
    dbInstance = await Database.load("sqlite:sqlite.db");
  }
  return dbInstance;
}

// Initialisiert Drizzle über den Proxy
export const db = drizzle(
  async (sql, params, method) => {
    const sqlite = await getDb();
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
