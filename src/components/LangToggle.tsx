import { useLanguage } from "../i18n/LanguageContext";

export function LangToggle() {
  const { lang, t, toggle } = useLanguage();
  return (
    <button
      type="button"
      className="lang-toggle"
      onClick={toggle}
      title={t.langHint}
      aria-label={t.langHint}
    >
      {lang === "en" ? "EN · BM" : "BM · EN"} → {t.langToggle}
    </button>
  );
}
