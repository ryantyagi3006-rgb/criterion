import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json();
  const user = await db.user.findUnique({ where: { email: (email ?? "").toLowerCase() } });
  if (!user || !bcrypt.compareSync(password ?? "", user.password))
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

  const token = await createSessionToken({ userId: user.id, role: user.role as "TEACHER" | "STUDENT", name: user.name });
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set("session", token, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
  return res;
}
