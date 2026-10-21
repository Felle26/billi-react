import { useTheme } from './ThemeContext';
import { useEffect, useState } from 'react';
import { isPostgresActive } from '../db';
import { LICENSE_CHANGED_EVENT, getLicenseState, loadLicense, type LicenseState } from '../db/license';

type Level = 'red' | 'yellow' | 'green';

export function Footer() {
  const Year = 2026;
  const { isDarkMode } = useTheme();
  const [licenseState, setLicenseState] = useState<LicenseState | null>(null);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const state = getLicenseState(await loadLicense());
        if (!cancelled) setLicenseState(state);
      } catch (error) {
        console.error('Lizenz konnte nicht gelesen werden:', error);
        if (!cancelled) setLicenseState('missing');
      }
    };
    void refresh();
    // Prüft auch bei laufender App, ob die Lizenz inzwischen abgelaufen ist
    const timer = window.setInterval(refresh, 60 * 60 * 1000);
    window.addEventListener(LICENSE_CHANGED_EVENT, refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener(LICENSE_CHANGED_EVENT, refresh);
    };
  }, []);

  let level: Level = 'red';
  let text = 'Lizenz wird geprüft…';
  if (licenseState === 'missing') {
    text = 'Keine Seriennummer eingegeben – Aktionen erforderlich!';
  } else if (licenseState === 'expired') {
    text = 'Lizenz abgelaufen – Aktionen erforderlich!';
  } else if (licenseState === 'valid') {
    if (isPostgresActive()) {
      level = 'green';
      text = 'Alles in Ordnung: PostgreSQL verbunden, Lizenz gültig';
    } else {
      level = 'yellow';
      text = 'Lizenz gültig, aber lokale SQLite-Datenbank aktiv';
    }
  }

  const dotClass = { red: 'bg-red-500', yellow: 'bg-yellow-500', green: 'bg-green-500' }[level];
  const pingClass = { red: 'bg-red-400', yellow: 'bg-yellow-400', green: 'bg-green-400' }[level];
  const textClass = {
    red: isDarkMode ? 'text-red-400' : 'text-red-600',
    yellow: isDarkMode ? 'text-yellow-300' : 'text-yellow-700',
    green: isDarkMode ? 'text-green-400' : 'text-green-600',
  }[level];

  return (
    <footer className={`w-full p-1 flex justify-between items-center transition-colors duration-300 ${
      isDarkMode 
        ? "bg-gray-500 text-gray-400" 
        : "bg-gray-50 text-gray-500 border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      }`}>
      <div className="flex items-center gap-2" role="status">
        <div className="relative flex h-3 w-3">
          {level === 'green' && (
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${pingClass} opacity-75`}></span>
          )}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${dotClass}`}></span>
        </div>
        <span className={`font-medium ${textClass}`}>{text}</span>
      </div>
      <p>© {Year === new Date().getFullYear() ? Year : `${Year} - ${new Date().getFullYear()}`}  -  Billi, Der Rechnungsprofi</p>
    </footer>
  );
}
