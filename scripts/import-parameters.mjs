import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

/** Parse TSV with RFC4180-style quoting: tabs as delimiters, quotes, escaped quotes, newlines in quotes. */
function parseTsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  while (i < text.length) {
    const c = text[i];

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += c;
      i += 1;
      continue;
    }

    if (c === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (c === '\t') {
      row.push(field);
      field = '';
      i += 1;
      continue;
    }

    if (c === '\r') {
      i += 1;
      continue;
    }

    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i += 1;
      continue;
    }

    field += c;
    i += 1;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(h) {
  return String(h ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\./g, '')
    .trim();
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(normalizeHeader);
  const out = [];
  for (let r = 1; r < rows.length; r += 1) {
    const cells = rows[r];
    if (cells.length === 1 && cells[0] === '') continue;
    const obj = {};
    for (let c = 0; c < headers.length; c += 1) {
      obj[headers[c]] = cells[c] ?? '';
    }
    out.push(obj);
  }
  return out;
}

function readTsvObjects(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  return rowsToObjects(parseTsv(text));
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data), 'utf8');
}

function mapActivities(rows) {
  const out = [];
  let n = 1;
  for (const r of rows) {
    const activityCode = String(r.activity_code ?? '').trim();
    if (!activityCode) continue;
    out.push({
      id: `act-${n}`,
      activityCode,
      activityName: r.activity_name ?? '',
      inUse: r.activity_iuse === 'Y',
      isAbstract: r.isAbstract === 'TRUE',
    });
    n += 1;
  }
  return out;
}

function mapOfferingGroups(rows) {
  const out = [];
  let n = 1;
  for (const r of rows) {
    const modOffCode = String(r.mod_off_code ?? '').trim();
    if (!modOffCode) continue;
    out.push({
      id: `off-${n}`,
      modOffCode,
      moduleCode: r.module_code ?? '',
      moduleName: r.module_name ?? '',
      occurrence: r.occurrence ?? '',
      academicYear: r.academic_year ?? '',
      periodSlot: r.period_slot ?? '',
      facultyCode: r.faculty_code ?? '',
      facultyName: r.faculty_name ?? '',
      location: r.location ?? '',
      scheme: r.scheme ?? '',
      level: Number(r.level) || 0,
      targetNoStudents: Number(r.target_no_students) || 0,
      actualNoStudents: Number(r.actual_no_students) || 0,
      coordinatorId: r.coordinator_id ?? '',
      creditValue: Number(r.credit_value) || 0,
      holidayCode: r.holiday_code ?? '',
      related: r.related ?? '',
      active: r.active === 'TRUE' || r.active === 'Y',
      isAbstract: r.isAbstract === 'TRUE',
    });
    n += 1;
  }
  return out;
}

function mapModules(rows) {
  const out = [];
  let n = 1;
  for (const r of rows) {
    const moduleCode = String(r.module_code ?? '').trim();
    if (!moduleCode) continue;
    out.push({
      id: `mod-${n}`,
      moduleCode,
      moduleEngDesc: r.module_eng_desc ?? '',
      moduleMalayDesc: r.module_malay_desc ?? '',
      moduleLevel: r.module_level ?? '',
      levelDesc: r.level_desc ?? '',
      moduleType: r.module_type ?? '',
      moduleDeptCode: r.module_dept_code ?? '',
      inUse: r.module_iuse === 'Y',
      scheme: r.scheme ?? '',
      credit: Number(r.credit) || 0,
      faculty: r.faculty ?? '',
      facultyDesc: r.faculty_desc ?? '',
      overallTarget: Number(r.overall_target) || 0,
      moduleRelated: r.module_related ?? '',
      active: r.active === 'TRUE' || r.active === 'Y',
      isAbstract: r.isAbstract === 'TRUE',
    });
    n += 1;
  }
  return out;
}

const sources = {
  activities: 'c:/Users/user/Downloads/activity.txt',
  offeringGroups: 'c:/Users/user/Downloads/Shun Offering Group.txt',
  modules: 'c:/Users/user/Downloads/Shun Module.txt',
};

const outputs = {
  activities: path.join(root, 'src/data/activities.seed.json'),
  offeringGroups: path.join(root, 'public/data/offeringGroups.seed.json'),
  modules: path.join(root, 'public/data/modules.seed.json'),
};

function firstLineCount(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  // Count physical lines ending with \n, plus trailing content without newline
  let count = 0;
  let i = 0;
  while (i < text.length) {
    const nl = text.indexOf('\n', i);
    if (nl === -1) {
      if (i < text.length) count += 1;
      break;
    }
    count += 1;
    i = nl + 1;
  }
  return count;
}

try {
  console.log('Source first-line counts (physical lines):');
  for (const [key, p] of Object.entries(sources)) {
    const n = firstLineCount(p);
    console.log(`  ${key}: ${n} lines — ${p}`);
  }

  const activityRows = readTsvObjects(sources.activities);
  const offeringRows = readTsvObjects(sources.offeringGroups);
  const moduleRows = readTsvObjects(sources.modules);

  const activities = mapActivities(activityRows);
  const offeringGroups = mapOfferingGroups(offeringRows);
  const modules = mapModules(moduleRows);

  writeJson(outputs.activities, activities);
  writeJson(outputs.offeringGroups, offeringGroups);
  writeJson(outputs.modules, modules);

  console.log('\nRecords written:');
  console.log(`  activities: ${activities.length} -> ${outputs.activities}`);
  console.log(`  offeringGroups: ${offeringGroups.length} -> ${outputs.offeringGroups}`);
  console.log(`  modules: ${modules.length} -> ${outputs.modules}`);

  console.log('\nOutput file sizes (bytes):');
  for (const [key, p] of Object.entries(outputs)) {
    const st = fs.statSync(p);
    console.log(`  ${key}: ${st.size}`);
  }
} catch (err) {
  console.error('ERROR:', err);
  process.exit(1);
}
