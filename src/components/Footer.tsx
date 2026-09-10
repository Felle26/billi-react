import { useTheme } from './ThemeContext';
import { useState } from 'react';
export function Footer() {
  const Year = 2026;
  const [isSystemOk, setIsSystemOk] = useState(true);
  const { isDarkMode } = useTheme();
  return (
    <footer className={`w-full p-1 flex justify-between items-center transition-colors duration-300 ${
      isDarkMode 
        ? "bg-gray-500 text-gray-400" 
        : "bg-gray-50 text-gray-500 border-t border-gray-200 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]"
      }`}>
      <div 
        className="flex items-center gap-2 cursor-pointer" 
        onClick={() => setIsSystemOk(!isSystemOk)}
      >
        <div className="relative flex h-3 w-3">
          {isSystemOk && (
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          )}
          <span className={`relative inline-flex rounded-full h-3 w-3 ${
            isSystemOk ? 'bg-green-500' : 'bg-red-500'
          }`}></span>
        </div>
        
        {/* Status Text */}
        <span className={`font-medium ${
          isSystemOk 
            ? (isDarkMode ? 'text-green-400' : 'text-green-600')
            : (isDarkMode ? 'text-red-400' : 'text-red-600')
        }`}>
          {isSystemOk ? 'System Online' : 'Verbindungsfehler'}
        </span>
      </div>
      <p>© {Year === new Date().getFullYear() ? Year : `${Year} - ${new Date().getFullYear()}`}  -  Billi, Der Rechnungsprofi</p>
    </footer>
  );
}