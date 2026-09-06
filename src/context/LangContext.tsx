import React, { createContext, useContext, useState } from 'react';
import { translations, Language } from '../translations';

interface LangContextType {
  lang: Language;
  toggleLang: () => void;
  t: typeof translations['bn'];
}

const LangContext = createContext<LangContextType>(null!);

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Language>('bn');
  const toggleLang = () => setLang(prev => prev === 'bn' ? 'en' : 'bn');
  const t = translations[lang];
  return <LangContext.Provider value={{ lang, toggleLang, t }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
