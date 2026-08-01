import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { name, email, password, role } = await req.json();
  if (!name || !email || !password || !["TEACHER", "STUDENT"].includes(role))
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  if (password.length < 8)
    return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const existing = await db.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const user = await db.user.create({
    data: { name, email: email.toLowerCase(), password: bcrypt.hashSync(password, 10), role },
  });
  const token = await createSessionToken({ userId: user.id, role: user.role as "TEACHER" | "STUDENT", name: user.name });
  const res = NextResponse.json({ ok: true, role: user.role });
  res.cookies.set("session", token, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 8, path: "/" });
  return res;
}
