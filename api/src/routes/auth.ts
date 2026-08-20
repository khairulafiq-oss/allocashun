import { Router } from "express";
import { loginUser, requireAuth, signToken, type AuthUser } from "../auth.js";
import type { Request } from "express";

export const authRouter = Router();

authRouter.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const user = await loginUser(email, password);
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }
  const token = signToken(user);
  res.json({ token, user });
});

authRouter.get("/me", requireAuth, (req, res) => {
  const user = (req as Request & { user?: AuthUser }).user;
  res.json({ user });
});
