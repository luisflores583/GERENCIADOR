import { cookies } from "next/headers";
import { prisma } from "./prisma";
import { readSessionToken, SESSION_COOKIE, signSession } from "./session";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const session = await readSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (!session) return null;
  return prisma.user.findUnique({
    where: { id: session.sub },
    select: { id: true, name: true, email: true },
  });
}

export async function setSession(userId: string) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await signSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}
