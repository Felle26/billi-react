import { Button } from '@fluentui/react-components';
import { useTheme } from './ThemeContext';
import { WeatherSunnyRegular, WeatherMoonRegular } from '@fluentui/react-icons';

export function Header() {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <header className="p-6 bg-gray-800 text-white flex justify-between items-center ">
      <Button appearance="primary">Kunden</Button>
      <Button appearance="primary" onClick={toggleTheme}>
        {isDarkMode ? <WeatherSunnyRegular /> : <WeatherMoonRegular />}
      </Button>
    </header>
  );
}