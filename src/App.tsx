import { useState } from "react";
import { AppShell } from "./components/AppShell";
import { LoginScreen } from "./components/LoginScreen";
import { LanguageProvider, useLanguage } from "./i18n/LanguageContext";
import { CalendarListPage } from "./pages/calendar/CalendarListPage";
import { CalendarWeekPage } from "./pages/calendar/CalendarWeekPage";
import { MechaAutoPage } from "./pages/mechatable/MechaAutoPage";
import { MechaSetupPage } from "./pages/mechatable/MechaSetupPage";
import { AuditLogPage } from "./pages/super-admin/AuditLogPage";
import { DashboardPage } from "./pages/super-admin/DashboardPage";
import { ParameterPage } from "./pages/super-admin/ParameterPage";
import { PermissionsPage } from "./pages/super-admin/PermissionsPage";
import { SecurityPage } from "./pages/super-admin/SecurityPage";
import { SystemPage } from "./pages/super-admin/SystemPage";
import { TimeParamsPage } from "./pages/super-admin/TimeParamsPage";
import { UsersPage } from "./pages/super-admin/UsersPage";
import { StoreProvider } from "./state/StoreContext";
import type { AppId, CalendarPage, MechaPage, SaPage } from "./types";
import "./styles/app.css";

const ADMIN_NAV = [
  { id: "dashboard", labelKey: "navDashboard" as const },
  { id: "users", labelKey: "navUsers" as const },
  { id: "time", labelKey: "navTime" as const },
  { id: "security", labelKey: "navSecurity" as const },
  { id: "parameter", labelKey: "navParameter" as const },
  { id: "permissions", labelKey: "navPermissions" as const },
  { id: "audit", labelKey: "navAudit" as const },
  { id: "system", labelKey: "navSystem" as const },
];

const MECHA_NAV = [
  { id: "setup", labelKey: "navMechaSetup" as const },
  { id: "auto", labelKey: "navMechaAuto" as const },
];

const CAL_NAV = [
  { id: "week", labelKey: "navCalWeek" as const },
  { id: "list", labelKey: "navCalList" as const },
];

function AdminApp({ onExit }: { onExit: () => void }) {
  const { t } = useLanguage();
  const [page, setPage] = useState<SaPage>("dashboard");

  let content = <DashboardPage />;
  if (page === "users") content = <UsersPage />;
  else if (page === "time") content = <TimeParamsPage />;
  else if (page === "security") content = <SecurityPage />;
  else if (page === "parameter") content = <ParameterPage />;
  else if (page === "permissions") content = <PermissionsPage />;
  else if (page === "audit") content = <AuditLogPage />;
  else if (page === "system") content = <SystemPage />;

  return (
    <AppShell
      brand="ALLOCASHUN"
      brandAccent="Admin"
      brandSubKey="brandSub"
      foot="Admin · master data & access control"
      userLabel={t.appAdmin}
      nav={ADMIN_NAV}
      page={page}
      onNavigate={(id) => setPage(id as SaPage)}
      onExit={onExit}
    >
      {content}
    </AppShell>
  );
}

function MechaTableApp({ onExit }: { onExit: () => void }) {
  const { t } = useLanguage();
  const [page, setPage] = useState<MechaPage>("setup");

  return (
    <AppShell
      brand="Mecha"
      brandAccent="Table"
      brandSubKey="brandMechaSub"
      foot="MechaTable · timetable builder"
      userLabel={t.appMechaTable}
      nav={MECHA_NAV}
      page={page}
      onNavigate={(id) => setPage(id as MechaPage)}
      onExit={onExit}
    >
      {page === "auto" ? <MechaAutoPage /> : <MechaSetupPage />}
    </AppShell>
  );
}

function CalendarApp({ onExit }: { onExit: () => void }) {
  const { t } = useLanguage();
  const [page, setPage] = useState<CalendarPage>("week");

  return (
    <AppShell
      brand="ALLOCASHUN"
      brandAccent="Calendar"
      brandSubKey="brandCalSub"
      foot="Calendar · schedule viewer"
      userLabel={t.appCalendar}
      nav={CAL_NAV}
      page={page}
      onNavigate={(id) => setPage(id as CalendarPage)}
      onExit={onExit}
    >
      {page === "list" ? <CalendarListPage /> : <CalendarWeekPage />}
    </AppShell>
  );
}

function RootApp() {
  const [app, setApp] = useState<AppId | null>(null);

  if (!app) {
    return <LoginScreen onSelectApp={setApp} />;
  }

  const exit = () => setApp(null);

  if (app === "admin") return <AdminApp onExit={exit} />;
  if (app === "mechatable") return <MechaTableApp onExit={exit} />;
  return <CalendarApp onExit={exit} />;
}

export default function App() {
  return (
    <LanguageProvider>
      <StoreProvider>
        <RootApp />
      </StoreProvider>
    </LanguageProvider>
  );
}
