import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSettings } from '../contexts/useSettings';

export function useThemeSync() {
  const { settings, updateSetting } = useSettings();
  const { i18n } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();

  // 1. Sync Settings -> DOM
  // This effect solely controls the DOM classes based on the current setting.
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    const updateDOM = () => {
      const activeTheme = settings.interface?.theme || 'dark';
      root.classList.remove('dark', 'theme-dracula', 'theme-alucard', 'theme-alucardlight');

      if (activeTheme === 'light') {
        // no classes needed
      } else if (activeTheme === 'dracula') {
        root.classList.add('dark', 'theme-dracula');
      } else if (activeTheme === 'alucard') {
        root.classList.add('dark', 'theme-alucard');
      } else if (activeTheme === 'alucardlight') {
        root.classList.add('theme-alucardlight'); // light — no dark class
      } else if (activeTheme === 'system') {
        if (mediaQuery.matches) {
          root.classList.add('dark');
        }
      } else {
        root.classList.add('dark');
      }
    };

    updateDOM();
    mediaQuery.addEventListener('change', updateDOM);
    return () => mediaQuery.removeEventListener('change', updateDOM);
  }, [settings.interface?.theme]);

  // 2. Sync Settings & Language -> URL
  // When the theme or language changes, update the URL silently
  useEffect(() => {
    setSearchParams(prev => {
      const activeTheme = settings.interface?.theme;
      const currentHl = i18n.language?.split('-')[0];
      
      const newParams = new URLSearchParams(prev);
      let changed = false;

      if (activeTheme && newParams.get('theme') !== activeTheme) {
        newParams.set('theme', activeTheme);
        changed = true;
      }

      if (currentHl && newParams.get('hl') !== currentHl) {
        newParams.set('hl', currentHl);
        changed = true;
      }
      
      return changed ? newParams : prev;
    }, { replace: true });
  }, [settings.interface?.theme, i18n.language, setSearchParams]);

  // 3. Sync URL -> App State (Mount Only)
  // Support deep-linking by checking the URL only once when the app loads
  useEffect(() => {
    // Theme
    const themeParam = searchParams.get('theme');
    if (themeParam && settings.interface?.theme !== themeParam) {
      updateSetting('interface.theme', themeParam);
    }

    // Language
    const hlParam = searchParams.get('hl');
    if (hlParam && i18n.language !== hlParam) {
      i18n.changeLanguage(hlParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
