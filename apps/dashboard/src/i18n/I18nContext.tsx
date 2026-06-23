import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, type Lang, type TranslationKey } from './translations';

interface I18nContextValue {
  lang: Lang;
  dir: 'ltr' | 'rtl';
  t: (key: TranslationKey) => string;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'titan:lang';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'ar' ? 'ar' : 'en';
  });

  const dir = lang === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);

  const setLang = useCallback((newLang: Lang) => {
    setLangState(newLang);
    localStorage.setItem(STORAGE_KEY, newLang);
  }, []);

  const toggleLang = useCallback(() => {
    setLang(lang === 'en' ? 'ar' : 'en');
  }, [lang, setLang]);

  const t = useCallback((key: TranslationKey) => {
    return translations[lang][key] ?? translations.en[key] ?? key;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, dir, t, setLang, toggleLang }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
