import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en, type Dict } from "./en";
import { ms } from "./ms";

export type Lang = "en" | "ms";

type LanguageContextValue = {
  lang: Lang;
  t: Dict;
  toggle: () => void;
  setLang: (lang: Lang) => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const dictionaries: Record<Lang, Dict> = { en, ms };

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem("um-tt-lang");
    return saved === "ms" || saved === "en" ? saved : "en";
  });

  const toggle = useCallback(() => {
    setLang((prev) => {
      const next = prev === "en" ? "ms" : "en";
      localStorage.setItem("um-tt-lang", next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      lang,
      t: dictionaries[lang],
      toggle,
      setLang: (next: Lang) => {
        localStorage.setItem("um-tt-lang", next);
        setLang(next);
      },
    }),
    [lang, toggle],
  );

  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
