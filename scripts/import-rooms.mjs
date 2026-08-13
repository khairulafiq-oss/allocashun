import fs from "fs";

const csvPath = "C:/Users/user/Downloads/Shun ROM.csv";
const outPath =
  "C:/Users/user/Documents/Shunedit/Frontend/src/data/rooms.seed.json";

function parseCsv(src) {
  const rows = [];
  let row = [];
  let field = "";
  let i = 0;
  let inQ = false;
  while (i < src.length) {
    const c = src[i];
    if (inQ) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQ = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQ = true;
      i++;
      continue;
    }
    if (c === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const text = fs.readFileSync(csvPath, "utf8");
const rows = parseCsv(text).filter((r) =>
  r.some((c) => String(c).trim() !== ""),
);
const header = rows[0].map((h) => h.trim());
const idx = Object.fromEntries(header.map((h, i) => [h, i]));

const rooms = rows
  .slice(1)
  .map((r, n) => {
    const get = (k) => (r[idx[k]] ?? "").trim();
    const seats = Number(get("Maximum Seats") || 0);
    const examCap = Number(get("Exam Capacity") || 0);
    const maxRows = Number(get("Room Maximum Rows") || 0);
    return {
      id: `room-${n + 1}`,
      roomCode: get("Room code"),
      shortName: get("Short name"),
      fullName: get("Full name"),
      buildingCode: get("Buildings code"),
      siteCode: get("Site code"),
      roomTypeCode: get("Room Type code"),
      roomTypeName: get("Room Type Name") || get("Room type name"),
      maximumSeats: Number.isFinite(seats) ? seats : 0,
      roomMaximumRows: Number.isFinite(maxRows) ? maxRows : 0,
      examCapacity: Number.isFinite(examCap) ? examCap : 0,
      feExamSystem: get("FE exam system"),
      roomFormatCode: get("Room format code"),
      locationCode: get("Location code"),
      inUse: get("In Use?").toUpperCase() === "Y",
      roomCollecDefForSite: get("Room collec def for SITE"),
      udf01: get("User Defined Field 01"),
      udf02: get("User Defined Field 02"),
      udf03: get("User Defined Field 03"),
      udf04: get("User Defined Field 04"),
      udf05: get("User Defined Field 05"),
      floor: get("Floor"),
    };
  })
  .filter((r) => r.roomCode);

fs.mkdirSync("C:/Users/user/Documents/Shunedit/Frontend/src/data", {
  recursive: true,
});
fs.writeFileSync(outPath, JSON.stringify(rooms, null, 2));
console.log(`Wrote ${rooms.length} rooms to ${outPath}`);
