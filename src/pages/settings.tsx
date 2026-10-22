// src/pages/settings.tsx
import { useState, useEffect } from 'react';
import { db, activatePostgres, deactivatePostgres, isPostgresActive, loadConnectionSettings } from '../db';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { licenseTypeLabel, useLicenseStatus } from '../components/LicenseGate';
import { 
  Input, 
  Button, 
  Label, 
  Divider, 
  Spinner,
  Checkbox,
} from '@fluentui/react-components';
import { FolderOpen20Regular, Save20Regular } from '@fluentui/react-icons';
import { DbBackup } from '../components/Db-backup';

interface PostgresConnectionSettings {
  host: string;
  port: string;
  database: string;
  username: string;
  password: string;
}

interface ConnectionTestResult {
  success: boolean;
  message: string;
}

function getErrorMessage(error: unknown, password: string) {
  const message = error instanceof Error ? error.message : String(error);
  return password ? message.split(password).join('[ausgeblendet]') : message;
}

export default function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingPostgres, setIsTestingPostgres] = useState(false);
  const [postgresConnection, setPostgresConnection] = useState<PostgresConnectionSettings>({
    host: '',
    port: '5432',
    database: '',
    username: '',
    password: '',
  });
  const [connectionTestResult, setConnectionTestResult] = useState<ConnectionTestResult | null>(null);
  const [postgresActiveNow, setPostgresActiveNow] = useState(isPostgresActive());
  const [hasStoredConnection, setHasStoredConnection] = useState(false);
  const [importLocalData, setImportLocalData] = useState(true);
  const [isSwitchingBackend, setIsSwitchingBackend] = useState(false);
  const [backendResult, setBackendResult] = useState<ConnectionTestResult | null>(null);
  const license = useLicenseStatus();
  const [isDeactivatingLicense, setIsDeactivatingLicense] = useState(false);
  const [licenseError, setLicenseError] = useState('');

  const handleDeactivateLicense = async () => {
    if (!window.confirm('Die Lizenz auf diesem Gerät wirklich abmelden? Du kannst sie danach auf einem anderen Gerät nutzen.')) {
      return;
    }
    setIsDeactivatingLicense(true);
    setLicenseError('');
    try {
      await license.deactivate();
    } catch (error) {
      const message = typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message: unknown }).message)
        : String(error);
      setLicenseError(message);
      setIsDeactivatingLicense(false);
    }
  };

  useEffect(() => {
    async function loadStoredConnection() {
      try {
        const stored = await loadConnectionSettings();
        if (!stored.encryptedConfig) return;
        const saved = await invoke<{ host: string; port: number; database: string; username: string }>(
          'pg_describe_config',
          { blob: stored.encryptedConfig },
        );
        setHasStoredConnection(true);
        setPostgresConnection((current) => ({
          ...current,
          host: saved.host,
          port: String(saved.port),
          database: saved.database,
          username: saved.username,
        }));
      } catch (error) {
        console.error('Gespeicherte Verbindungsdaten nicht lesbar:', error);
      }
    }
    loadStoredConnection();
  }, []);
  
  // State für alle Einstellungen
  const [config, setConfig] = useState({
    company_name: '',
    owner_name: '',
    street: '',
    zip: '',
    city: '',
    phone: '',
    email: '',
    tax_id: '',
    tax_number: '',
    vat_id: '',
    bank: '',
    iban: '',
    bic: '',
    backup_path: '',
    invoice_path: '',
    logo_path: '',
    next_invoice_number: 1,
  });

  // Lädt die Einstellungen beim Öffnen der Seite
  useEffect(() => {
    async function loadSettings() {
      try {
        const result = await db.select().from(settings).where(eq(settings.id, 1));
        if (result.length > 0) {
          setConfig(result[0] as any);
        } else {
          // Falls noch keine Einstellungen existieren, legen wir einen leeren Datensatz (ID 1) an
          await db.insert(settings).values({ id: 1 });
        }
      } catch (error) {
        console.error("Fehler beim Laden der Einstellungen:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  // Aktualisiert den lokalen State bei Eingaben
  const handleChange = (field: string, value: string | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  };

  // Speichert die Einstellungen in SQLite
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await db.update(settings).set(config).where(eq(settings.id, 1));
      alert("Einstellungen erfolgreich gespeichert!");
    } catch (error) {
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern der Einstellungen.");
    } finally {
      setIsSaving(false);
    }
  };

  // Öffnet einen Ordner-Dialog über Tauri
  const selectFolder = async (field: 'backup_path' | 'invoice_path') => {
    try {
      const selectedPath = await open({
        directory: true, // Erlaubt nur die Auswahl von Ordnern
        multiple: false,
      });
      
      if (selectedPath && typeof selectedPath === 'string') {
        handleChange(field, selectedPath);
      }
    } catch (error) {
      console.error("Fehler bei der Ordnerauswahl:", error);
    }
  };

  const selectLogo = async () => {
    try {
      const selectedPath = await open({
        directory: false,
        multiple: false,
        filters: [{ name: 'Bilddateien', extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg'] }],
      });

      if (selectedPath && typeof selectedPath === 'string') {
        handleChange('logo_path', selectedPath);
      }
    } catch (error) {
      console.error("Fehler bei der Logoauswahl:", error);
    }
  };

  const testPostgresConnection = async () => {
    setConnectionTestResult(null);
    setIsTestingPostgres(true);

    try {
      const host = postgresConnection.host.trim();
      const databaseName = postgresConnection.database.trim();
      const username = postgresConnection.username.trim();
      const port = Number(postgresConnection.port);

      if (!host || !databaseName || !username || !postgresConnection.password) {
        throw new Error('Bitte Host, Datenbank, Benutzername und Passwort eingeben.');
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Der Port muss eine Zahl zwischen 1 und 65535 sein.');
      }

      await invoke('test_postgres_connection', {
        host,
        port,
        database: databaseName,
        username,
        password: postgresConnection.password,
      });

      setConnectionTestResult({
        success: true,
        message: 'Verbindung erfolgreich: Anmeldung und SQL-Testabfrage waren erfolgreich.',
      });
    } catch (error) {
      console.error('PostgreSQL-Verbindungstest fehlgeschlagen:', error);
      setConnectionTestResult({
        success: false,
        message: `Verbindung fehlgeschlagen: ${getErrorMessage(error, postgresConnection.password)}`,
      });
    } finally {
      setIsTestingPostgres(false);
    }
  };

  const activateBackend = async () => {
    setBackendResult(null);
    setIsSwitchingBackend(true);
    try {
      const port = Number(postgresConnection.port);
      if (
        !postgresConnection.host.trim() ||
        !postgresConnection.database.trim() ||
        !postgresConnection.username.trim() ||
        !postgresConnection.password
      ) {
        throw new Error('Bitte Host, Datenbank, Benutzername und Passwort eingeben.');
      }
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        throw new Error('Der Port muss eine Zahl zwischen 1 und 65535 sein.');
      }

      const info = await activatePostgres(
        {
          host: postgresConnection.host.trim(),
          port,
          database: postgresConnection.database.trim(),
          username: postgresConnection.username.trim(),
          password: postgresConnection.password,
        },
        { importLocalData },
      );
      setPostgresActiveNow(true);
      setHasStoredConnection(true);
      setPostgresConnection((current) => ({ ...current, password: '' }));
      setBackendResult({
        success: true,
        message: `PostgreSQL ist jetzt aktiv. Die Verbindungsdaten wurden verschlüsselt gespeichert. ${info}`.trim(),
      });
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('PostgreSQL konnte nicht aktiviert werden:', error);
      setBackendResult({
        success: false,
        message: `Aktivierung fehlgeschlagen: ${getErrorMessage(error, postgresConnection.password)}`,
      });
    } finally {
      setIsSwitchingBackend(false);
    }
  };

  const deactivateBackend = async () => {
    setBackendResult(null);
    setIsSwitchingBackend(true);
    try {
      await deactivatePostgres();
      window.location.reload();
    } catch (error) {
      setBackendResult({ success: false, message: `Umschalten fehlgeschlagen: ${getErrorMessage(error, '')}` });
      setIsSwitchingBackend(false);
    }
  };

  if (isLoading) return <div className="p-8"><Spinner label="Lade Einstellungen..." /></div>;

  return (
    <div className="flex flex-col items-center h-[calc(100vh-140px)]">
      <div className="w-full max-w-4xl h-full flex flex-col gap-6 overflow-y-auto no-scrollbar bg-white dark:bg-gray-800 p-8 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Einstellungen</h2>
          <Button 
            appearance="primary" 
            icon={isSaving ? <Spinner size="tiny" /> : <Save20Regular />} 
            onClick={handleSave}
            disabled={isSaving}
          >
            Speichern
          </Button>
        </div>

        <Divider />

        {/* BEREICH: Kontaktdaten */}
        <div>
          <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">Kontaktdaten (Rechnungsabsender)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label>Firmenname</Label>
              <Input value={config.company_name} onChange={(e) => handleChange('company_name', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Inhaber / Geschäftsführer</Label>
              <Input value={config.owner_name} onChange={(e) => handleChange('owner_name', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Straße & Hausnummer</Label>
              <Input value={config.street} onChange={(e) => handleChange('street', e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-1 col-span-1">
                <Label>PLZ</Label>
                <Input value={config.zip} onChange={(e) => handleChange('zip', e.target.value)} />
              </div>
              <div className="flex flex-col gap-1 col-span-2">
                <Label>Ort</Label>
                <Input value={config.city} onChange={(e) => handleChange('city', e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Label>Telefon</Label>
              <Input value={config.phone} onChange={(e) => handleChange('phone', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>E-Mail</Label>
              <Input type="email" value={config.email} onChange={(e) => handleChange('email', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Steuernummer</Label>
              <Input value={config.tax_number} onChange={(e) => handleChange('tax_number', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>USt-IdNr.</Label>
              <Input value={config.vat_id} onChange={(e) => handleChange('vat_id', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>Bank</Label>
              <Input value={config.bank} onChange={(e) => handleChange('bank', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>IBAN</Label>
              <Input value={config.iban} onChange={(e) => handleChange('iban', e.target.value)} />
            </div>
            <div className="flex flex-col gap-1">
              <Label>BIC</Label>
              <Input value={config.bic} onChange={(e) => handleChange('bic', e.target.value)} />
            </div>
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">Rechnungsnummer</h3>
          <div className="flex max-w-sm flex-col gap-1">
            <Label>Nummer der nächsten Rechnung</Label>
            <Input
              type="number"
              min={1}
              value={String(config.next_invoice_number)}
              onChange={(e) => handleChange('next_invoice_number', e.target.value === '' ? 1 : Number(e.target.value))}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Diese Nummer wird bei der Rechnungserstellung verwendet und danach automatisch erhöht.
            </span>
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">Rechnungslogo</h3>
          <div className="flex flex-col gap-1">
            <Label>Logo für Rechnungen (PNG, JPG, WEBP oder SVG)</Label>
            <div className="flex gap-2">
              <Input
                readOnly
                value={config.logo_path}
                placeholder="Noch kein Logo ausgewählt"
                className="grow"
              />
              <Button icon={<FolderOpen20Regular />} onClick={selectLogo}>
                Bild auswählen
              </Button>
            </div>
          </div>
        </div>

        <Divider />

        {/* BEREICH: Speicherpfade */}
        <div>
          <h3 className="text-lg font-medium mb-4 text-gray-800 dark:text-gray-200">Speicherpfade</h3>
          
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <Label>Pfad für Rechnungen (PDF & ZUGFeRD)</Label>
              <div className="flex gap-2">
                <Input 
                  readOnly 
                  value={config.invoice_path} 
                  placeholder="Z. B. C:\Rechnungen oder \\NAS\Rechnungen" 
                  className="grow" 
                />
                <Button icon={<FolderOpen20Regular />} onClick={() => selectFolder('invoice_path')}>
                  Durchsuchen
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <Label>Pfad für Datenbank-Backups</Label>
              <div className="flex gap-2">
                <Input 
                  readOnly 
                  value={config.backup_path} 
                  placeholder="Z. B. D:\Backups" 
                  className="grow" 
                />
                <Button icon={<FolderOpen20Regular />} onClick={() => selectFolder('backup_path')}>
                  Durchsuchen
                </Button>
              </div>
              <DbBackup backupDirectory={config.backup_path} />
            </div>
            
            <div className="flex flex-col gap-1 mt-2">
              <Label>Speicherort der aktiven Datenbank (sqlite.db)</Label>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Wird von Tauri automatisch im gesicherten AppData-Ordner verwaltet (%appdata%).
              </span>
            </div>
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="text-lg font-medium mb-2 text-gray-800 dark:text-gray-200">
            PostgreSQL-Datenbank im Netzwerk
          </h3>
          <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
            Aktuell verwendet: <strong>{postgresActiveNow ? 'PostgreSQL' : 'lokale SQLite-Datenbank'}</strong>.
            Ist PostgreSQL aktiviert, werden alle Daten dort gespeichert. Die Verbindungsdaten
            werden verschlüsselt (AES-256-GCM, Schlüssel im Windows-Anmeldeinformationsspeicher)
            in der lokalen SQLite-Datenbank abgelegt.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <Label htmlFor="postgres-host">Server / Hostname</Label>
              <Input
                id="postgres-host"
                autoComplete="off"
                placeholder="z. B. 192.168.1.10"
                value={postgresConnection.host}
                onChange={(event) => setPostgresConnection((current) => ({ ...current, host: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="postgres-port">Port</Label>
              <Input
                id="postgres-port"
                type="number"
                min={1}
                max={65535}
                value={postgresConnection.port}
                onChange={(event) => setPostgresConnection((current) => ({ ...current, port: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="postgres-database">Datenbank</Label>
              <Input
                id="postgres-database"
                autoComplete="off"
                value={postgresConnection.database}
                onChange={(event) => setPostgresConnection((current) => ({ ...current, database: event.target.value }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="postgres-username">Benutzername</Label>
              <Input
                id="postgres-username"
                autoComplete="off"
                value={postgresConnection.username}
                onChange={(event) => setPostgresConnection((current) => ({ ...current, username: event.target.value }))}
              />
            </div>
            <div className="col-span-2 flex flex-col gap-1">
              <Label htmlFor="postgres-password">Passwort</Label>
              <Input
                id="postgres-password"
                type="password"
                autoComplete="new-password"
                placeholder={hasStoredConnection ? 'Gespeichert – zum Ändern neu eingeben' : ''}
                value={postgresConnection.password}
                onChange={(event) => setPostgresConnection((current) => ({ ...current, password: event.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-col items-start gap-2">
            <Checkbox
              checked={importLocalData}
              onChange={(_, data) => setImportLocalData(Boolean(data.checked))}
              label="Lokale Daten übernehmen (nur wenn die PostgreSQL-Datenbank leer ist)"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                appearance="primary"
                onClick={activateBackend}
                disabled={isSwitchingBackend}
                icon={isSwitchingBackend ? <Spinner size="tiny" /> : undefined}
              >
                {postgresActiveNow ? 'Verbindung aktualisieren' : 'Speichern & PostgreSQL aktivieren'}
              </Button>
              {postgresActiveNow && (
                <Button appearance="secondary" onClick={deactivateBackend} disabled={isSwitchingBackend}>
                  Zurück zur lokalen SQLite-Datenbank
                </Button>
              )}
            </div>
            {backendResult && (
              <p
                role={backendResult.success ? 'status' : 'alert'}
                className={backendResult.success ? 'text-sm text-green-700' : 'text-sm text-red-600'}
              >
                {backendResult.message}
              </p>
            )}
          </div>
          <div className="mt-4 flex flex-col items-start gap-2">
            <Button
              appearance="secondary"
              onClick={testPostgresConnection}
              disabled={isTestingPostgres}
              icon={isTestingPostgres ? <Spinner size="tiny" /> : undefined}
            >
              {isTestingPostgres ? 'Verbindung wird geprüft…' : 'PostgreSQL-Verbindung testen'}
            </Button>
            {connectionTestResult && (
              <p
                role={connectionTestResult.success ? 'status' : 'alert'}
                className={connectionTestResult.success ? 'text-sm text-green-700' : 'text-sm text-red-600'}
              >
                {connectionTestResult.message}
              </p>
            )}
          </div>
        </div>

        <Divider />

        <div>
          <h3 className="mb-2 text-lg font-medium text-gray-800 dark:text-gray-200">Lizenz</h3>
          <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Produkt</dt>
              <dd className="font-medium">{license.status.product || '–'}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">Lizenztyp</dt>
              <dd className="font-medium">{licenseTypeLabel(license.status.kind)}</dd>
            </div>
            <div>
              <dt className="text-gray-500 dark:text-gray-400">
                {license.status.kind === 'trial' ? 'Testzeitraum' : 'Gültig bis'}
              </dt>
              <dd className="font-medium">
                {license.status.kind === 'trial'
                  ? `noch ${license.status.daysLeft ?? 0} ${license.status.daysLeft === 1 ? 'Tag' : 'Tage'}`
                  : license.status.expiresAt
                    ? new Date(license.status.expiresAt).toLocaleDateString('de-DE')
                    : 'Unbefristet'}
              </dd>
            </div>
          </dl>
          {license.status.offline && (
            <p role="status" className="mt-3 text-sm text-amber-700 dark:text-amber-300">
              Der Lizenzserver war nicht erreichbar. Die App läuft vorübergehend mit dem zuletzt
              bestätigten Lizenzstatus.
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {license.status.kind === 'trial' ? (
              <>
                <Button appearance="primary" onClick={license.openShop}>Lizenz kaufen</Button>
                <Button appearance="secondary" onClick={license.enterKey}>Lizenzschlüssel eingeben</Button>
              </>
            ) : (
              <Button
                appearance="secondary"
                disabled={isDeactivatingLicense}
                onClick={() => void handleDeactivateLicense()}
              >
                {isDeactivatingLicense ? 'Wird abgemeldet…' : 'Lizenz auf diesem Gerät abmelden'}
              </Button>
            )}
          </div>
          {licenseError && (
            <p role="alert" className="mt-2 text-sm text-red-600">{licenseError}</p>
          )}
        </div>

      </div>
    </div>
  );
}