import { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';

// 1. Typen definieren
interface ThemeContextType {
  isDarkMode: boolean;
  toggleTheme: () => void;
}

// 2. Context erstellen
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 3. Einen eigenen Provider-Wrapper bauen
export const AppThemeProvider = ({ children }: { children: ReactNode }) => {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const savedTheme = localStorage.getItem('app-theme');
    if (savedTheme) return savedTheme === 'dark';
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    localStorage.setItem('app-theme', isDarkMode ? 'dark' : 'light');
    
    // Optional: Hintergrund des body-Tags global setzen
    document.body.style.backgroundColor = isDarkMode ? '#242424' : '#ffffff';
    document.body.style.color = isDarkMode ? '#ffffff' : '#242424';
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode((prev) => !prev);

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
      {/* Hier wird der originale FluentProvider gesteuert! */}
      <FluentProvider theme={isDarkMode ? webDarkTheme : webLightTheme}>
        {children}
      </FluentProvider>
    </ThemeContext.Provider>
  );
};

// 4. Custom Hook erstellen, damit wir den Context leichter nutzen können
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within an AppThemeProvider");
  }
  return context;
};