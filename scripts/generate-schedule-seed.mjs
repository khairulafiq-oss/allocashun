import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const offerings = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/offeringGroups.seed.json"), "utf8"),
);
const rooms = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/rooms.seed.json"), "utf8"),
);
const activities = JSON.parse(
  fs.readFileSync(path.join(root, "src/data/activities.seed.json"), "utf8"),
);

const FACULTIES = ["A", "AA", "S", "K", "I", "W"];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const TIME_SLOTS = [
  ["08:00", "09:00"],
  ["09:00", "10:00"],
  ["10:00", "11:00"],
  ["11:00", "12:00"],
  ["12:00", "13:00"],
  ["14:00", "15:00"],
  ["15:00", "16:00"],
  ["16:00", "17:00"],
  ["14:00", "17:00"],
  ["09:00", "11:00"],
];
const ACTIVITY_CYCLE = ["LEC", "TUT", "LAB", "SEM", "PRA"];
const WEEKS = ["1-14", "1-7", "8-14", "2-12"];
const TARGET = 80;

const activityByCode = Object.fromEntries(
  activities.map((a) => [a.activityCode, a]),
);

function roomsForFaculty(facultyCode) {
  const inUse = rooms.filter((r) => r.inUse);
  let matched = inUse.filter((r) => r.udf01 === facultyCode);
  if (matched.length === 0) {
    matched = inUse.filter((r) => !r.udf01 || r.udf01 === "");
    if (matched.length === 0) {
      matched = inUse.filter((r) => r.siteCode === "UM");
    }
  }
  return matched;
}

const offeringsByFaculty = Object.fromEntries(
  FACULTIES.map((f) => [f, offerings.filter((o) => o.facultyCode === f)]),
);

const roomsByFaculty = Object.fromEntries(
  FACULTIES.map((f) => [f, roomsForFaculty(f)]),
);

const occupied = new Set();
const entries = [];
const createdAt = new Date().toISOString();

const base = Math.floor(TARGET / FACULTIES.length);
const rem = TARGET % FACULTIES.length;
const quotas = FACULTIES.map((_, i) => base + (i < rem ? 1 : 0));

let globalIdx = 0;

for (let fi = 0; fi < FACULTIES.length; fi++) {
  const facultyCode = FACULTIES[fi];
  const facOfferings = offeringsByFaculty[facultyCode];
  const facRooms = roomsByFaculty[facultyCode];
  if (!facOfferings.length || !facRooms.length) {
    console.warn("Skipping " + facultyCode + ": offerings=" + facOfferings.length + " rooms=" + facRooms.length);
    continue;
  }

  let made = 0;
  let attempt = 0;
  const maxAttempts = quotas[fi] * 40;

  while (made < quotas[fi] && attempt < maxAttempts) {
    const off = facOfferings[(globalIdx + attempt) % facOfferings.length];
    const actCode = ACTIVITY_CYCLE[globalIdx % ACTIVITY_CYCLE.length];
    const act = activityByCode[actCode];
    const day = DAYS[globalIdx % DAYS.length];
    const [startTime, endTime] = TIME_SLOTS[globalIdx % TIME_SLOTS.length];
    const slot = startTime + "-" + endTime;
    const weeks = WEEKS[globalIdx % WEEKS.length];
    attempt++;

    let placed = false;
    for (let ri = 0; ri < facRooms.length; ri++) {
      const room = facRooms[(globalIdx + ri) % facRooms.length];
      const occKey = room.roomCode + "|" + day + "|" + startTime;
      if (occupied.has(occKey)) continue;
      occupied.add(occKey);
      entries.push({
        id: "sch-" + (entries.length + 1),
        facultyCode: off.facultyCode,
        facultyName: off.facultyName,
        offeringId: off.id,
        modOffCode: off.modOffCode,
        moduleCode: off.moduleCode,
        moduleName: off.moduleName,
        occurrence: off.occurrence,
        activityCode: act.activityCode,
        activityName: act.activityName,
        roomCode: room.roomCode,
        roomName: room.fullName || room.shortName || room.roomCode,
        lecturer: off.coordinatorId || "",
        day,
        slot,
        startTime,
        endTime,
        weeks,
        academicYear: off.academicYear,
        periodSlot: off.periodSlot,
        createdAt,
      });
      made++;
      globalIdx++;
      placed = true;
      break;
    }
    if (!placed) globalIdx++;
  }

  if (made < quotas[fi]) {
    console.warn(facultyCode + ": only made " + made + "/" + quotas[fi]);
  }
}

let topUp = 0;
while (entries.length < TARGET && topUp < TARGET * 20) {
  const facultyCode = FACULTIES[topUp % FACULTIES.length];
  const facOfferings = offeringsByFaculty[facultyCode];
  const facRooms = roomsByFaculty[facultyCode];
  const off = facOfferings[topUp % facOfferings.length];
  const actCode = ACTIVITY_CYCLE[topUp % ACTIVITY_CYCLE.length];
  const act = activityByCode[actCode];
  const day = DAYS[topUp % DAYS.length];
  const [startTime, endTime] = TIME_SLOTS[(topUp + 3) % TIME_SLOTS.length];
  const slot = startTime + "-" + endTime;
  const weeks = WEEKS[topUp % WEEKS.length];

  for (const room of facRooms) {
    const occKey = room.roomCode + "|" + day + "|" + startTime;
    if (occupied.has(occKey)) continue;
    occupied.add(occKey);
    entries.push({
      id: "sch-" + (entries.length + 1),
      facultyCode: off.facultyCode,
      facultyName: off.facultyName,
      offeringId: off.id,
      modOffCode: off.modOffCode,
      moduleCode: off.moduleCode,
      moduleName: off.moduleName,
      occurrence: off.occurrence,
      activityCode: act.activityCode,
      activityName: act.activityName,
      roomCode: room.roomCode,
      roomName: room.fullName || room.shortName || room.roomCode,
      lecturer: off.coordinatorId || "",
      day,
      slot,
      startTime,
      endTime,
      weeks,
      academicYear: off.academicYear,
      periodSlot: off.periodSlot,
      createdAt,
    });
    break;
  }
  topUp++;
}

const outPath = path.join(root, "src/data/schedule.seed.json");
fs.writeFileSync(outPath, JSON.stringify(entries) + "\n", "utf8");

const byDay = Object.fromEntries(DAYS.map((d) => [d, 0]));
for (const e of entries) byDay[e.day] = (byDay[e.day] || 0) + 1;

console.log("Wrote", outPath);
console.log("Per day:", byDay);
console.log("Total:", entries.length);
console.log(
  "Per faculty:",
  Object.fromEntries(
    FACULTIES.map((f) => [f, entries.filter((e) => e.facultyCode === f).length]),
  ),
);
