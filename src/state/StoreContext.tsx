import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  dashboardStats,
  initialAudit,
  initialPermissions,
  initialSecurity,
  initialSystem,
  initialUsers,
} from "../data/mock";
import {
  loadCalendars,
  loadTimeRules,
  saveCalendars,
  saveTimeRules,
} from "../storage/calendarStorage";
import {
  loadActivities,
  saveActivities,
} from "../storage/activityStorage";
import { loadFaculties, saveFaculties } from "../storage/facultyStorage";
import {
  loadModules,
  saveModules,
} from "../storage/moduleStorage";
import {
  loadOfferingGroups,
  saveOfferingGroups,
} from "../storage/offeringGroupStorage";
import { loadRooms, saveRooms } from "../storage/roomStorage";
import { loadSchedule, saveSchedule } from "../storage/scheduleStorage";
import {
  loadCancelledSchedule,
  saveCancelledSchedule,
} from "../storage/cancelledScheduleStorage";
import { calendarsSeed, timeRulesSeed } from "../data/calendars.seed";
import {
  apiLoadDocument,
  apiSaveDocument,
  getApiToken,
  isApiMode,
} from "../lib/apiClient";
import { ensureConstraints } from "../lib/scheduleConstraints";
import type {
  AcademicCalendar,
  Activity,
  AuditEntry,
  CancelReason,
  CancelledScheduleRecord,
  Faculty,
  Module,
  OfferingGroup,
  PermissionMatrix,
  Room,
  ScheduleEntry,
  MechaSelection,
  SecuritySettings,
  SystemSettings,
  TimeRules,
  UserAccount,
} from "../types";

function debounce(fn: (key: string, payload: unknown) => void, ms: number) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (key: string, payload: unknown) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(key, payload), ms);
  };
}

const cloudSave = debounce((key: string, payload: unknown) => {
  if (!isApiMode() || !getApiToken()) return;
  void apiSaveDocument(key, payload).catch((err) => {
    console.warn(`[cloud] save ${key} failed`, err);
  });
}, 500);

type Flash = { kind: "ok" | "bad"; message: string } | null;

type Store = {
  users: UserAccount[];
  setUsers: React.Dispatch<React.SetStateAction<UserAccount[]>>;
  faculties: Faculty[];
  setFaculties: React.Dispatch<React.SetStateAction<Faculty[]>>;
  rooms: Room[];
  setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
  activities: Activity[];
  setActivities: React.Dispatch<React.SetStateAction<Activity[]>>;
  offeringGroups: OfferingGroup[];
  setOfferingGroups: React.Dispatch<React.SetStateAction<OfferingGroup[]>>;
  modules: Module[];
  setModules: React.Dispatch<React.SetStateAction<Module[]>>;
  paramListsReady: boolean;
  schedule: ScheduleEntry[];
  setSchedule: React.Dispatch<React.SetStateAction<ScheduleEntry[]>>;
  cancelledSchedule: CancelledScheduleRecord[];
  archiveScheduleEntries: (
    entries: ScheduleEntry[],
    reason: CancelReason,
    actor?: string,
  ) => void;
  restoreCancelledEntry: (cancelId: string) => ScheduleEntry | null;
  purgeCancelledEntry: (cancelId: string) => void;
  calendars: AcademicCalendar[];
  setCalendars: React.Dispatch<React.SetStateAction<AcademicCalendar[]>>;
  timeRules: TimeRules;
  setTimeRules: React.Dispatch<React.SetStateAction<TimeRules>>;
  security: SecuritySettings;
  setSecurity: React.Dispatch<React.SetStateAction<SecuritySettings>>;
  system: SystemSettings;
  setSystem: React.Dispatch<React.SetStateAction<SystemSettings>>;
  permissions: PermissionMatrix;
  setPermissions: React.Dispatch<React.SetStateAction<PermissionMatrix>>;
  audit: AuditEntry[];
  pushAudit: (action: string, detail: string, actor?: string) => void;
  stats: typeof dashboardStats;
  setStats: React.Dispatch<React.SetStateAction<typeof dashboardStats>>;
  flash: Flash;
  setFlash: (flash: Flash) => void;
  mechaSelection: MechaSelection;
  setMechaSelection: React.Dispatch<React.SetStateAction<MechaSelection>>;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState(initialUsers);
  const [faculties, setFaculties] = useState<Faculty[]>(() => loadFaculties());
  const [rooms, setRooms] = useState<Room[]>(() => loadRooms());
  const [activities, setActivities] = useState<Activity[]>(() =>
    loadActivities(),
  );
  const [offeringGroups, setOfferingGroups] = useState<OfferingGroup[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [paramListsReady, setParamListsReady] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleEntry[]>(() => loadSchedule());
  const [cancelledSchedule, setCancelledSchedule] = useState<
    CancelledScheduleRecord[]
  >(() => loadCancelledSchedule());
  const [calendars, setCalendars] = useState<AcademicCalendar[]>(() =>
    loadCalendars(),
  );
  const [timeRules, setTimeRules] = useState<TimeRules>(() => loadTimeRules());
  const [security, setSecurity] = useState(initialSecurity);
  const [system, setSystem] = useState(initialSystem);
  const [permissions, setPermissions] = useState(initialPermissions);
  const [audit, setAudit] = useState(initialAudit);
  const [stats, setStats] = useState(dashboardStats);
  const [flash, setFlashState] = useState<Flash>(null);
  const [mechaSelection, setMechaSelection] = useState<MechaSelection>({
    facultyCodes: [],
    moduleCodes: [],
    offeringIds: [],
    roomCodes: [],
    lecturerIds: [],
    activityCode: "",
    day: "",
    slot: "",
    weeks: "",
    academicYears: [],
    periodSlots: [],
  });
  const [cloudHydrated, setCloudHydrated] = useState(false);

  /** Load shared documents from Linux Docker API when logged in. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isApiMode() || !getApiToken()) {
        setCloudHydrated(true);
        return;
      }
      try {
        const [
          remoteCalendars,
          remoteRules,
          remoteSchedule,
          remoteCancelled,
          remoteFaculties,
          remoteRooms,
          remoteActivities,
        ] = await Promise.all([
          apiLoadDocument<AcademicCalendar[]>("calendars"),
          apiLoadDocument<TimeRules>("time_rules"),
          apiLoadDocument<ScheduleEntry[]>("schedule"),
          apiLoadDocument<CancelledScheduleRecord[]>("cancelled_schedule"),
          apiLoadDocument<Faculty[]>("faculties"),
          apiLoadDocument<Room[]>("rooms"),
          apiLoadDocument<Activity[]>("activities"),
        ]);
        if (cancelled) return;

        if (Array.isArray(remoteCalendars) && remoteCalendars.length > 0) {
          setCalendars(remoteCalendars);
        } else {
          const seed = structuredClone(calendarsSeed);
          setCalendars(seed);
          void apiSaveDocument("calendars", seed);
        }

        if (remoteRules && Array.isArray(remoteRules.slotRules)) {
          setTimeRules(ensureConstraints(remoteRules));
        } else {
          const seed = ensureConstraints(structuredClone(timeRulesSeed));
          setTimeRules(seed);
          void apiSaveDocument("time_rules", seed);
        }

        if (Array.isArray(remoteSchedule)) setSchedule(remoteSchedule);
        if (Array.isArray(remoteCancelled)) {
          setCancelledSchedule(remoteCancelled);
        }
        if (Array.isArray(remoteFaculties) && remoteFaculties.length > 0) {
          setFaculties(remoteFaculties);
        }
        if (Array.isArray(remoteRooms) && remoteRooms.length > 0) {
          setRooms(remoteRooms);
        }
        if (Array.isArray(remoteActivities) && remoteActivities.length > 0) {
          setActivities(remoteActivities);
        }
      } catch (err) {
        console.warn("[cloud] hydrate failed", err);
      } finally {
        if (!cancelled) setCloudHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadOfferingGroups(), loadModules()])
      .then(([nextOfferings, nextModules]) => {
        if (cancelled) return;
        setOfferingGroups(nextOfferings);
        setModules(nextModules);
        setParamListsReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setParamListsReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    saveFaculties(faculties);
    if (cloudHydrated) cloudSave("faculties", faculties);
  }, [faculties, cloudHydrated]);

  useEffect(() => {
    saveRooms(rooms);
    if (cloudHydrated) cloudSave("rooms", rooms);
  }, [rooms, cloudHydrated]);

  useEffect(() => {
    saveActivities(activities);
    if (cloudHydrated) cloudSave("activities", activities);
  }, [activities, cloudHydrated]);

  useEffect(() => {
    if (!paramListsReady) return;
    void saveOfferingGroups(offeringGroups);
  }, [offeringGroups, paramListsReady]);

  useEffect(() => {
    if (!paramListsReady) return;
    void saveModules(modules);
  }, [modules, paramListsReady]);

  useEffect(() => {
    saveSchedule(schedule);
    if (cloudHydrated) cloudSave("schedule", schedule);
  }, [schedule, cloudHydrated]);

  useEffect(() => {
    saveCancelledSchedule(cancelledSchedule);
    if (cloudHydrated) cloudSave("cancelled_schedule", cancelledSchedule);
  }, [cancelledSchedule, cloudHydrated]);

  useEffect(() => {
    saveCalendars(calendars);
    if (cloudHydrated) cloudSave("calendars", calendars);
  }, [calendars, cloudHydrated]);

  useEffect(() => {
    saveTimeRules(timeRules);
    if (cloudHydrated) cloudSave("time_rules", timeRules);
  }, [timeRules, cloudHydrated]);

  const setFlash = useCallback((next: Flash) => {
    setFlashState(next);
  }, []);

  const pushAudit = useCallback(
    (action: string, detail: string, actor = "afiq.shun@um.edu.my") => {
      const entry: AuditEntry = {
        id: `a${Date.now()}`,
        at: new Date().toISOString(),
        actor,
        action,
        detail,
      };
      setAudit((prev) => [entry, ...prev]);
    },
    [],
  );

  const archiveScheduleEntries = useCallback(
    (
      entries: ScheduleEntry[],
      reason: CancelReason,
      actor = "afiq.shun@um.edu.my",
    ) => {
      if (entries.length === 0) return;
      const stamp = Date.now();
      const records: CancelledScheduleRecord[] = entries.map((entry, index) => ({
        cancelId: `cancel-${entry.id}-${stamp}-${index}`,
        cancelledAt: new Date().toISOString(),
        cancelledBy: actor,
        reason,
        entry: structuredClone(entry),
      }));
      setCancelledSchedule((prev) => [...records, ...prev]);
    },
    [],
  );

  const restoreCancelledEntry = useCallback((cancelId: string) => {
    let restored: ScheduleEntry | null = null;
    setCancelledSchedule((prev) => {
      const record = prev.find((row) => row.cancelId === cancelId);
      if (!record) return prev;
      restored = record.entry;
      return prev.filter((row) => row.cancelId !== cancelId);
    });
    if (restored) {
      setSchedule((prev) => [...prev, restored as ScheduleEntry]);
    }
    return restored;
  }, []);

  const purgeCancelledEntry = useCallback((cancelId: string) => {
    setCancelledSchedule((prev) =>
      prev.filter((row) => row.cancelId !== cancelId),
    );
  }, []);

  const value = useMemo(
    () => ({
      users,
      setUsers,
      faculties,
      setFaculties,
      rooms,
      setRooms,
      activities,
      setActivities,
      offeringGroups,
      setOfferingGroups,
      modules,
      setModules,
      paramListsReady,
      schedule,
      setSchedule,
      cancelledSchedule,
      archiveScheduleEntries,
      restoreCancelledEntry,
      purgeCancelledEntry,
      calendars,
      setCalendars,
      timeRules,
      setTimeRules,
      security,
      setSecurity,
      system,
      setSystem,
      permissions,
      setPermissions,
      audit,
      pushAudit,
      stats,
      setStats,
      flash,
      setFlash,
      mechaSelection,
      setMechaSelection,
    }),
    [
      users,
      faculties,
      rooms,
      activities,
      offeringGroups,
      modules,
      paramListsReady,
      schedule,
      cancelledSchedule,
      archiveScheduleEntries,
      restoreCancelledEntry,
      purgeCancelledEntry,
      calendars,
      timeRules,
      security,
      system,
      permissions,
      audit,
      pushAudit,
      stats,
      flash,
      setFlash,
      mechaSelection,
      setMechaSelection,
    ],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
