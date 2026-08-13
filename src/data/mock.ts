import type {
  AuditEntry,
  PermissionMatrix,
  SecuritySettings,
  SystemSettings,
  UserAccount,
} from "../types";

export const initialUsers: UserAccount[] = [
  {
    id: "u1",
    name: "afiq shun",
    email: "afiq.shun@um.edu.my",
    role: "super_admin",
    facultyCode: null,
    active: true,
  },
  {
    id: "u2",
    name: "Dr. Lim Wei Ming",
    email: "registrar.admin@um.edu.my",
    role: "admin",
    facultyCode: null,
    active: true,
  },
  {
    id: "u3",
    name: "Siti Noraini",
    email: "central.tt@um.edu.my",
    role: "central_user",
    facultyCode: null,
    active: true,
  },
  {
    id: "u4",
    name: "Assoc. Prof. Azman",
    email: "tt.fcsit@um.edu.my",
    role: "faculty_user",
    facultyCode: "W",
    active: true,
  },
  {
    id: "u5",
    name: "Nurul Huda",
    email: "tt.feng@um.edu.my",
    role: "faculty_user",
    facultyCode: "K",
    active: false,
  },
  {
    id: "u6",
    name: "Student Portal Viewer",
    email: "viewer@um.edu.my",
    role: "viewer",
    facultyCode: null,
    active: true,
  },
];

export const initialSecurity: SecuritySettings = {
  minPasswordLength: 12,
  requireUppercase: true,
  requireNumber: true,
  requireSymbol: true,
  sessionTimeoutMins: 45,
  maxLoginAttempts: 5,
  twoFactorEnabled: true,
  maintenanceMode: false,
  auditRetentionDays: 365,
};

export const initialSystem: SystemSettings = {
  sitsEndpoint: "https://sits.um.edu.my/api/timetable",
  vbaEnginePath: "\\\\um-files\\tt\\engines\\ClashSolver.xlsm",
  exportFormat: "CSV",
};

export const initialPermissions: PermissionMatrix = {
  super_admin: {
    read: true,
    write: true,
    approve: true,
    lock: true,
    publish: true,
  },
  admin: {
    read: true,
    write: true,
    approve: true,
    lock: true,
    publish: true,
  },
  central_user: {
    read: true,
    write: true,
    approve: false,
    lock: false,
    publish: false,
  },
  faculty_user: {
    read: true,
    write: true,
    approve: false,
    lock: false,
    publish: false,
  },
  viewer: {
    read: true,
    write: false,
    approve: false,
    lock: false,
    publish: false,
  },
};

export const initialAudit: AuditEntry[] = [
  {
    id: "a1",
    at: "2026-08-07T08:12:00+08:00",
    actor: "afiq.shun@um.edu.my",
    action: "SECURITY_UPDATE",
    detail: "Enabled 2FA policy for privileged roles",
  },
  {
    id: "a2",
    at: "2026-08-06T16:40:00+08:00",
    actor: "afiq.shun@um.edu.my",
    action: "USER_ROLE_CHANGE",
    detail: "Assigned central_user to siti.noraini@um.edu.my",
  },
  {
    id: "a3",
    at: "2026-08-05T11:05:00+08:00",
    actor: "registrar.admin@um.edu.my",
    action: "SCHEDULE_LOCK",
    detail: "Locked FES draft for central review",
  },
  {
    id: "a4",
    at: "2026-08-04T09:22:00+08:00",
    actor: "afiq.shun@um.edu.my",
    action: "TIME_PARAMS",
    detail: "Set teaching weeks 1–14 for 2025/2026 Sem 1",
  },
  {
    id: "a5",
    at: "2026-08-03T14:18:00+08:00",
    actor: "central.tt@um.edu.my",
    action: "CLASH_RESOLVE",
    detail: "Resolved room DK1 conflict FCSIT vs FOS",
  },
];

export const dashboardStats = {
  draftSchedules: 7,
  lockedSchedules: 2,
};
