import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import {
  apiHealth,
  apiLogin,
  getApiToken,
  isApiMode,
  setApiToken,
  type ApiUser,
} from "../lib/apiClient";
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
  const [cloud, setCloud] = useState<"checking" | "on" | "off">("checking");
  const [user, setUser] = useState<ApiUser | null>(null);
  const [email, setEmail] = useState("admin@allocashun.local");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isApiMode()) {
        if (!cancelled) setCloud("off");
        return;
      }
      const ok = await apiHealth();
      if (cancelled) return;
      if (!ok) {
        setCloud("off");
        return;
      }
      setCloud("on");
      if (getApiToken()) {
        // Token exists — allow app picker without re-login
        setUser({
          id: "session",
          email: "signed-in",
          name: "Signed in",
          role: "super_admin",
          facultyCode: null,
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiLogin(email.trim(), password);
      setApiToken(result.token);
      setUser(result.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  function onLogout() {
    setApiToken(null);
    setUser(null);
    setPassword("");
  }

  const showApps = cloud === "off" || user !== null;

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

        {cloud === "checking" ? (
          <p className="lead">Checking server…</p>
        ) : null}

        {cloud === "on" && !user ? (
          <form className="login-form" onSubmit={onLogin}>
            <p className="tt-step-hint">
              Server login required (shared database).
            </p>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </label>
            <label className="field">
              <span>Password</span>
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error ? <p className="flash bad">{error}</p> : null}
            <button type="submit" className="btn" disabled={busy}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="tt-step-hint">
              Default: admin@allocashun.local / admin123
            </p>
          </form>
        ) : null}

        {cloud === "on" && user ? (
          <div className="chip-row" style={{ marginBottom: "0.75rem" }}>
            <span className="badge badge-ok">{user.email || user.name}</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onLogout}>
              Sign out
            </button>
          </div>
        ) : null}

        {showApps ? (
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
        ) : null}
      </div>
    </div>
  );
}
