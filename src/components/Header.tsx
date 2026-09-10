import { Button } from '@fluentui/react-components';
import { useTheme } from './ThemeContext';
import { 
  WeatherSunnyRegular, 
  WeatherMoonRegular, 
  DataBarVerticalAscending20Regular, 
  BookDatabase20Regular, 
  Settings20Regular, 
  People20Regular, 
  Apps20Regular 
} from '@fluentui/react-icons';
import { useNavigate } from 'react-router-dom';

export function Header() {
  const { isDarkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  return (
    <header className={`w-full p-1 flex justify-center items-center transition-colors duration-300 ${
      isDarkMode 
        ? "bg-gray-500 text-white" 
        : "bg-white text-gray-900 shadow-sm border-b border-gray-200"
    }`}>
      <div className="ml-auto flex items-center gap-4">
        <nav className="flex gap-2">
          <Button 
            appearance="transparent" 
            icon={<DataBarVerticalAscending20Regular />} 
            onClick={() => navigate('/dashboard')}
          >
            Dashboard
          </Button>
          
          <Button 
            appearance="transparent" 
            icon={<People20Regular />} 
            onClick={() => navigate('/customers')}
          >
            Kunden
          </Button>
          
          <Button 
            appearance="transparent" 
            icon={<Apps20Regular />} 
            onClick={() => navigate('/customer_objects')}
          >
            Objekte
          </Button>
          
          <Button 
            appearance="transparent" 
            icon={<BookDatabase20Regular />} 
            onClick={() => navigate('/invoice')}
          >
            Rechnungen
          </Button>
          
          
          
          <div className="ml-4">
            <Button 
            appearance="transparent" 
            icon={<Settings20Regular />} 
            onClick={() => navigate('/settings')}
          >
            Settings
          </Button>
            <Button 
              appearance="transparent" 
              icon={isDarkMode ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
              onClick={toggleTheme}
            />
          </div>
          
        </nav>
      </div>
    </header>
  );
}