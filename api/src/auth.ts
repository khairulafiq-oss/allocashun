import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "./db.js";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
  facultyCode: string | null;
};

const JWT_SECRET = process.env.JWT_SECRET || "change-this-jwt-secret-in-production";

export function signToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      facultyCode: user.facultyCode,
    },
    JWT_SECRET,
    { expiresIn: "12h" },
  );
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as jwt.JwtPayload;
    (req as Request & { user?: AuthUser }).user = {
      id: String(payload.sub),
      email: String(payload.email),
      name: String(payload.name ?? ""),
      role: String(payload.role ?? "viewer"),
      facultyCode:
        payload.facultyCode == null ? null : String(payload.facultyCode),
    };
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export async function ensureDefaultAdmin(): Promise<void> {
  const existing = await query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1 LIMIT 1",
    ["admin@allocashun.local"],
  );
  if (existing.rowCount && existing.rowCount > 0) return;

  const hash = await bcrypt.hash("admin123", 10);
  await query(
    `INSERT INTO users (id, email, name, password_hash, role, active)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [
      "user-admin-1",
      "admin@allocashun.local",
      "ALLOCASHUN Admin",
      hash,
      "super_admin",
    ],
  );
  console.log(
    "[api] Seeded default admin: admin@allocashun.local / admin123 (change this password)",
  );
}

export async function loginUser(
  email: string,
  password: string,
): Promise<AuthUser | null> {
  const result = await query<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
    role: string;
    faculty_code: string | null;
    active: boolean;
  }>("SELECT * FROM users WHERE lower(email) = lower($1) LIMIT 1", [email]);

  const row = result.rows[0];
  if (!row || !row.active) return null;
  const ok = await bcrypt.compare(password, row.password_hash);
  if (!ok) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    facultyCode: row.faculty_code,
  };
}
