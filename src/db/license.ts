import { getSqliteDatabase } from './index';

export interface LicenseSettings {
  serialNumber: string;
  expiresAt: string; // YYYY-MM-DD, leer = unbefristet
}

export type LicenseState = 'missing' | 'expired' | 'valid';

export const LICENSE_CHANGED_EVENT = 'license-changed';

export async function loadLicense(): Promise<LicenseSettings> {
  const sqlite = await getSqliteDatabase();
  const rows = await sqlite.select<{ serial_number: string; expires_at: string }[]>(
    'SELECT serial_number, expires_at FROM license_settings WHERE id = 1',
  );
  return {
    serialNumber: rows[0]?.serial_number ?? '',
    expiresAt: rows[0]?.expires_at ?? '',
  };
}

export async function saveLicense(license: LicenseSettings) {
  const sqlite = await getSqliteDatabase();
  await sqlite.execute(
    'INSERT INTO license_settings (id, serial_number, expires_at) VALUES (1, $1, $2) ' +
      'ON CONFLICT(id) DO UPDATE SET serial_number = excluded.serial_number, expires_at = excluded.expires_at',
    [license.serialNumber.trim(), license.expiresAt],
  );
  window.dispatchEvent(new Event(LICENSE_CHANGED_EVENT));
}

export function getLicenseState(license: LicenseSettings): LicenseState {
  if (!license.serialNumber.trim()) return 'missing';
  if (license.expiresAt) {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if (license.expiresAt < todayKey) return 'expired';
  }
  return 'valid';
}
