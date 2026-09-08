import { save } from '@tauri-apps/plugin-dialog';
import { sql } from 'drizzle-orm';
import { Button } from '@fluentui/react-components';

// WICHTIG: Du musst hier deine konfigurierte Drizzle-Datenbank importieren.
// Passe den Pfad '../db' an, je nachdem wo deine db.ts oder index.ts von Drizzle liegt!
import { db } from '../db/index';

export function DbBackup() {
  
  // 1. Die eigentliche Datenbank-Funktion
  async function createDatabaseBackup(destinationPath: string) {
    try {
      // Windows-Pfade sicher machen
      const safePath = destinationPath.replace(/\\/g, '/');
      
      // Führt den Backup-Befehl aus
      await db.run(sql.raw(`VACUUM INTO '${safePath}'`));
      
      console.log("Backup erfolgreich an:", safePath);
      alert("Backup wurde erfolgreich erstellt!"); // Hier später gerne durch einen schönen Toast ersetzen
      
    } catch (error) {
      console.error("Fehler beim Backup:", error);
      alert("Es gab einen Fehler beim Erstellen des Backups.");
    }
  }

  // 2. Die Handler-Funktion für den Button
  async function handleBackup() {
    // Öffnet den nativen Speichern-Dialog
    const backupPath = await save({
      filters: [{
        name: 'SQLite Datenbank',
        extensions: ['db', 'sqlite']
      }],
      defaultPath: 'rechnungen_backup.db',
    });

    // Wenn der Nutzer abbrechen klickt, ist backupPath null
    if (!backupPath) return;

    // Pfad an die Datenbank übergeben
    await createDatabaseBackup(backupPath);
  }

  // 3. Das UI-Element (Button)
  return (
    <Button 
      onClick={handleBackup} 
      className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
    >
      Datenbank Backup erstellen
    </Button>
  );
}