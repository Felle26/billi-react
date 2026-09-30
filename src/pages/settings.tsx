// src/pages/settings.tsx
import { useState, useEffect } from 'react';
import { db } from '../db';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';
import { open } from '@tauri-apps/plugin-dialog';
import { 
  Input, 
  Button, 
  Label, 
  Divider, 
  Spinner 
} from '@fluentui/react-components';
import { FolderOpen20Regular, Save20Regular } from '@fluentui/react-icons';

export default function Settings() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
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
    backup_path: '',
    invoice_path: '',
    logo_path: ''
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
  const handleChange = (field: string, value: string) => {
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
              <Label>Steuernummer / USt-IdNr.</Label>
              <Input value={config.tax_id} onChange={(e) => handleChange('tax_id', e.target.value)} />
            </div>
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
            </div>
            
            <div className="flex flex-col gap-1 mt-2">
              <Label>Speicherort der aktiven Datenbank (sqlite.db)</Label>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Wird von Tauri automatisch im gesicherten AppData-Ordner verwaltet (%appdata%).
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}