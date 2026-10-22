import { useTheme } from './ThemeContext';
import { isPostgresActive } from '../db';
import { useLicenseStatus } from './LicenseGate';

type Level = 'red' | 'yellow' | 'green';

export function Footer() {
  const Year = 2026;
  const { isDarkMode } = useTheme();
  const license = useLicenseStatus();

  let level: Level = 'green';
  let text: string;
  if (license.status.kind === 'trial') {
    level = 'yellow';
    const days = license.status.daysLeft ?? 0;
    text = `Testversion – noch ${days} ${days === 1 ? 'Tag' : 'Tage'}`;
  } else if (isPostgresActive()) {
    text = 'Alles in Ordnung: PostgreSQL verbunden, Lizenz gültig';
  } else {
    level = 'yellow';
    text = 'Lizenz gültig, aber lokale SQLite-Datenbank aktiv';
  }
  if (license.status.offline) {
    level = 'yellow';
    text += ' (offline, Lizenz nicht neu bestätigt)';
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
        {license.status.kind === 'trial' && (
          <button
            type="button"
            onClick={license.openShop}
            className="rounded px-2 py-0 text-xs underline shadow-none"
          >
            Jetzt kaufen
          </button>
        )}
      </div>
      <p>© {Year === new Date().getFullYear() ? Year : `${Year} - ${new Date().getFullYear()}`}  -  Billi, Der Rechnungsprofi</p>
    </footer>
  );
}
