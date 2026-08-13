export type Role =
  | "super_admin"
  | "admin"
  | "central_user"
  | "faculty_user"
  | "viewer";

export type AppId = "admin" | "mechatable" | "calendar";

export type SaPage =
  | "dashboard"
  | "users"
  | "time"
  | "security"
  | "parameter"
  | "permissions"
  | "audit"
  | "system";

export type MechaPage = "setup" | "auto";

export type CalendarPage = "week" | "list";

export type PermissionAction =
  | "read"
  | "write"
  | "approve"
  | "lock"
  | "publish";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: Role;
  facultyCode: string | null;
  active: boolean;
}

export interface Faculty {
  id: string;
  /** CSV: Faculty code (e.g. W, AA) */
  facultyCode: string;
  /** CSV: Short name (e.g. FSKTM) */
  shortName: string;
  /** CSV: Full name */
  fullName: string;
  /** CSV: Active (Y/N) */
  active: boolean;
  /** CSV: Full name bahasa */
  fullNameBm: string;
  /** CSV: Email address */
  email: string;
}

/** From activity.txt */
export interface Activity {
  id: string;
  activityCode: string;
  activityName: string;
  inUse: boolean;
  isAbstract: boolean;
}

/** From Shun Offering Group.txt */
export interface OfferingGroup {
  id: string;
  modOffCode: string;
  moduleCode: string;
  moduleName: string;
  occurrence: string;
  academicYear: string;
  periodSlot: string;
  facultyCode: string;
  facultyName: string;
  location: string;
  scheme: string;
  level: number;
  targetNoStudents: number;
  actualNoStudents: number;
  coordinatorId: string;
  creditValue: number;
  holidayCode: string;
  related: string;
  active: boolean;
  isAbstract: boolean;
}

/** From Shun Module.txt */
export interface Module {
  id: string;
  moduleCode: string;
  moduleEngDesc: string;
  moduleMalayDesc: string;
  moduleLevel: string;
  levelDesc: string;
  moduleType: string;
  moduleDeptCode: string;
  inUse: boolean;
  scheme: string;
  credit: number;
  faculty: string;
  facultyDesc: string;
  overallTarget: number;
  moduleRelated: string;
  active: boolean;
  isAbstract: boolean;
}

/** From Shun ROM.csv — used when users set up timetable slots */
export interface Room {
  id: string;
  roomCode: string;
  shortName: string;
  fullName: string;
  buildingCode: string;
  siteCode: string;
  roomTypeCode: string;
  roomTypeName: string;
  maximumSeats: number;
  roomMaximumRows: number;
  examCapacity: number;
  feExamSystem: string;
  roomFormatCode: string;
  locationCode: string;
  inUse: boolean;
  roomCollecDefForSite: string;
  udf01: string; // faculty code owner in Shun ROM
  udf02: string;
  udf03: string;
  udf04: string;
  udf05: string;
  floor: string;
}

/** Current parameter selection from MechaTable setup (used for Calendar live preview). */
export interface MechaSelection {
  facultyCodes: string[];
  moduleCodes: string[];
  offeringIds: string[];
  roomCodes: string[];
  lecturerIds: string[];
  activityCode: string;
  day: string;
  slot: string;
  weeks: string;
  academicYears: string[];
  periodSlots: string[];
}

export interface CalendarBreak {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface AcademicCalendar {
  id: string;
  academicYear: string;
  semester: string;
  semesterStart: string;
  semesterEnd: string;
  teachingWeeksStart: number;
  teachingWeeksEnd: number;
  breaks: CalendarBreak[];
  isActive: boolean;
  notes: string;
}

export interface TimeSlotRule {
  id: string;
  label: string;
  days: string[];
  /** Whitelist pairs used during scheduling, e.g. "08:00-09:30" */
  slots: string[];
  dayStart: string;
  dayEnd: string;
  stepMins: number;
  minDurationMins: number;
}

/** Allowed clock window within a day, e.g. 08:00–13:00. */
export interface TimeWindow {
  start: string;
  end: string;
}

/**
 * Scheduling constraint profile (UG / PG / Morning / Afternoon / Evening).
 * Filters whitelist slots so classes only land inside these windows.
 */
export interface ScheduleConstraint {
  id: string;
  code: string;
  label: string;
  /** Human-readable timing for Manual/Auto pickers. */
  summary: string;
  enabled: boolean;
  /** Windows for Mon–Thu / Sat / Sun (and Fri when fridayWindows is empty). */
  weekdayWindows: TimeWindow[];
  /** Friday override (Jumaat). Empty = use weekdayWindows. */
  fridayWindows: TimeWindow[];
}

export interface TimeRules {
  slotRules: TimeSlotRule[];
  clashRoom: boolean;
  clashLecturer: boolean;
  clashOccurrence: boolean;
  constraints: ScheduleConstraint[];
}

export interface SecuritySettings {
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  sessionTimeoutMins: number;
  maxLoginAttempts: number;
  twoFactorEnabled: boolean;
  maintenanceMode: boolean;
  auditRetentionDays: number;
}

export interface SystemSettings {
  sitsEndpoint: string;
  vbaEnginePath: string;
  exportFormat: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  detail: string;
}

export type PermissionMatrix = Record<Role, Record<PermissionAction, boolean>>;

/**
 * Future per-offering session pattern (LEC+TUT, durations).
 * Manual compose still creates one ScheduleEntry per Add.
 */
export interface SessionRequirement {
  id: string;
  offeringId: string;
  activityCode: string;
  durationMins: number;
  weekPattern: string;
  lecturerIds: string[];
  roomCodes: string[];
  consecutive: boolean;
}

/** Manual fixed value vs let the generator choose. */
export type AutoParamMode = "manual" | "auto";

/** How auto-generate picks among Time Rules whitelist slots. */
export type AutoSlotSpread = "padding" | "random";

/**
 * One scheduling pattern row for auto-generate.
 * Scoped to a module (and optionally specific occurrences).
 * One module may have several patterns (e.g. 2×LEC + 1×TUT).
 */
export interface AutoSchedulePattern {
  id: string;
  label: string;
  /** Module this pattern applies to (from package). */
  moduleCode: string;
  /**
   * Occurrences this pattern applies to.
   * Empty = all occurrences of moduleCode in the loaded package.
   */
  occurrenceCodes: string[];
  activityCode: string;
  /** How many independent slots of this pattern to place per occurrence. */
  sessionsCount: number;
  durationMins: number;
  weekMode: AutoParamMode;
  weekPattern: string;
  dayMode: AutoParamMode;
  preferredDays: string[];
  timeMode: AutoParamMode;
  preferredStart: string;
  preferredEnd: string;
  roomMode: AutoParamMode;
  preferredRoomCodes: string[];
  lecturerMode: AutoParamMode;
  preferredLecturerIds: string[];
  /** Prefer consecutive periods on the same day when sessionsCount > 1. */
  consecutive: boolean;
}

/**
 * User-filled scheduling defaults for auto-generate.
 * Student package Excel does not provide day/time/room/lecturer/weeks.
 */
export interface AutoGenerateParams {
  academicYear: string;
  periodSlot: string;
  facultyCode: string;
  /** Required schedule constraint profile id (UG default). */
  constraintId: string;
  patterns: AutoSchedulePattern[];
  /** Spread slots across days (padding) or pick randomly from whitelist. */
  slotSpread: AutoSlotSpread;
  respectCapacity: boolean;
  allowClashes: boolean;
}

export interface DietPackageOccurrence {
  code: string;
  enrolled: number;
  capacity: number;
}

export interface DietPackageModule {
  dietModuleCode: string;
  offeredModuleCode: string | null;
  occurrences: DietPackageOccurrence[];
}

export interface DietPackageGroup {
  kumpulan: string;
  seqn: string;
  minv: number | null;
  maxv: number | null;
  modules: DietPackageModule[];
}

/** One cohort package (DIET) from MOR44-style student package export. */
export interface StudentDiet {
  facultyCode: string;
  program: string;
  route: string;
  dietCode: string;
  batch: string;
  studentCount: number;
  groups: DietPackageGroup[];
}

export interface DietPackagePreview {
  fileName: string;
  diets: StudentDiet[];
  dietCount: number;
  moduleReqCount: number;
  offeredCount: number;
  studentTotal: number;
}

/** One scheduled class slot created in MechaTable */
export interface ScheduleEntry {
  id: string;
  facultyCode: string;
  facultyName: string;
  offeringId: string;
  modOffCode: string;
  moduleCode: string;
  moduleName: string;
  occurrence: string;
  activityCode: string;
  activityName: string;
  roomCode: string;
  roomName: string;
  lecturer: string;
  day: string;
  slot: string;
  startTime: string;
  endTime: string;
  weeks: string;
  academicYear: string;
  periodSlot: string;
  createdAt: string;
}

export type CancelReason = "remove" | "bulk_remove" | "clear_all";

/** Archived slot removed from the active timetable — can be restored. */
export interface CancelledScheduleRecord {
  cancelId: string;
  cancelledAt: string;
  cancelledBy: string;
  reason: CancelReason;
  entry: ScheduleEntry;
}
