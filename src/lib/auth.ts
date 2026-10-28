import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

// A missing secret must stop the app rather than fall back to a shared,
// public value: with a known secret, anyone can forge a session for any
// user. Development is allowed one fixed stand-in so a fresh clone runs, and
// production is not.
function sessionSecret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (value) return new TextEncoder().encode(value);
  if (process.env.NODE_ENV === "production")
    throw new Error("AUTH_SECRET is not set. Session signing cannot be trusted.");
  return new TextEncoder().encode("dev-only-insecure-secret");
}

const secret = sessionSecret();

export type Session = { userId: string; role: "TEACHER" | "STUDENT"; name: string };

export async function createSessionToken(session: Session) {
  return new SignJWT(session)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get("session")?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const session = await getSession();
  if (!session) return null;
  return db.user.findUnique({ where: { id: session.userId } });
}
