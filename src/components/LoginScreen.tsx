import { useLanguage } from "../i18n/LanguageContext";
import type { AppId } from "../types";
import { LangToggle } from "./LangToggle";

type Props = {
  onSelectApp: (app: AppId) => void;
};

const APPS: {
  id: AppId;
  titleKey: "appAdmin" | "appMechaTable" | "appCalendar";
  ledeKey: "appAdminLede" | "appMechaTableLede" | "appCalendarLede";
}[] = [
  { id: "admin", titleKey: "appAdmin", ledeKey: "appAdminLede" },
  { id: "mechatable", titleKey: "appMechaTable", ledeKey: "appMechaTableLede" },
  { id: "calendar", titleKey: "appCalendar", ledeKey: "appCalendarLede" },
];

export function LoginScreen({ onSelectApp }: Props) {
  const { t } = useLanguage();

  return (
    <div className="login-screen">
      <div className="login-card login-card-apps">
        <div className="login-card-top">
          <div />
          <LangToggle />
        </div>
        <h1 className="brand-mark">
          ALLOCA<span>SHUN</span>
        </h1>
        <p className="lede">{t.loginLede}</p>
        <div className="app-picker">
          {APPS.map((app) => (
            <button
              key={app.id}
              type="button"
              className="app-picker-card"
              onClick={() => onSelectApp(app.id)}
            >
              <strong>{t[app.titleKey]}</strong>
              <span>{t[app.ledeKey]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
