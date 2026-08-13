import type { ReactNode } from "react";
import type { Dict } from "../i18n/en";
import { useLanguage } from "../i18n/LanguageContext";
import { LangToggle } from "./LangToggle";

export type ShellNavItem = {
  id: string;
  labelKey: keyof Dict;
};

type Props = {
  brand: string;
  brandAccent: string;
  brandSubKey: keyof Dict;
  foot: string;
  userLabel: string;
  nav: ShellNavItem[];
  page: string;
  onNavigate: (page: string) => void;
  onExit: () => void;
  children: ReactNode;
};

export function AppShell({
  brand,
  brandAccent,
  brandSubKey,
  foot,
  userLabel,
  nav,
  page,
  onNavigate,
  onExit,
  children,
}: Props) {
  const { t } = useLanguage();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="brand-mark">
            {brand} <span>{brandAccent}</span>
          </p>
          <p className="brand-sub">{t[brandSubKey]}</p>
        </div>
        <ul className="nav-list">
          {nav.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={page === item.id ? "active" : ""}
                onClick={() => onNavigate(item.id)}
              >
                {t[item.labelKey]}
              </button>
            </li>
          ))}
        </ul>
        <div className="sidebar-foot">{foot}</div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-user">
            <strong>afiq shun</strong>
            <span>
              {t.youAre} · {userLabel}
            </span>
          </div>
          <div className="topbar-actions">
            <LangToggle />
            <button type="button" className="btn btn-ghost btn-sm" onClick={onExit}>
              {t.backToApps}
            </button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
