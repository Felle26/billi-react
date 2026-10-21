import { useState } from 'react';
import { Button } from '@fluentui/react-components';
import { save } from '@tauri-apps/plugin-dialog';
import { getSqliteDatabase } from '../db';

interface DbBackupProps {
  backupDirectory: string;
}

export function DbBackup({ backupDirectory }: DbBackupProps) {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupMessage, setBackupMessage] = useState('');
  const [backupError, setBackupError] = useState(false);

  async function handleBackup() {
    setBackupError(false);
    setBackupMessage('');
    setIsBackingUp(true);

    try {
      const timestamp = new Date().toISOString().replace(/[-:.]/g, '');
      const fileName = `billi-backup-${timestamp}.db`;
      const trimmedDirectory = backupDirectory.trim().replace(/[\\/]+$/, '');
      const separator = backupDirectory.includes('\\') ? '\\' : '/';
      const backupPath = await save({
        filters: [{ name: 'SQLite Datenbank', extensions: ['db', 'sqlite'] }],
        defaultPath: trimmedDirectory
          ? `${trimmedDirectory}${separator}${fileName}`
          : fileName,
      });

      if (!backupPath) return;

      const sqlite = await getSqliteDatabase();
      const escapedBackupPath = backupPath.replace(/'/g, "''");
      await sqlite.execute(`VACUUM INTO '${escapedBackupPath}'`);
      setBackupMessage(`Backup erfolgreich erstellt: ${backupPath}`);
    } catch (error) {
      console.error('Fehler beim Erstellen des Datenbank-Backups:', error);
      setBackupError(true);
      setBackupMessage(
        `Backup konnte nicht erstellt werden: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setIsBackingUp(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button appearance="secondary" onClick={handleBackup} disabled={isBackingUp}>
        {isBackingUp ? 'Backup wird erstellt…' : 'Datenbank-Backup erstellen'}
      </Button>
      {backupMessage && (
        <p
          role={backupError ? 'alert' : 'status'}
          className={backupError ? 'text-sm text-red-600' : 'text-sm text-green-700'}
        >
          {backupMessage}
        </p>
      )}
    </div>
  );
}