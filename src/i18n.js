import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import en from './locales/en/index.js';
import es from './locales/es/index.js';
import ja from './locales/ja/index.js';

const resources = {
  en,
  es,
  ja
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    detection: {
      order: ['querystring', 'localStorage', 'navigator'],
      lookupQuerystring: 'hl',
    },
    interpolation: {
      escapeValue: false
    }
  });

export default i18n;
