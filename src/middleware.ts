import { NextResponse, type NextRequest } from "next/server";
import { readSessionToken, SESSION_COOKIE } from "./lib/session";

const PROTECTED = ["/inicio", "/perfil", "/atletas", "/dupla", "/desafios", "/desafiar", "/agenda"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!needsAuth) return NextResponse.next();

  const session = await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = "/entrar";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/inicio/:path*", "/perfil/:path*", "/atletas/:path*", "/dupla/:path*", "/desafios/:path*", "/desafiar/:path*", "/agenda/:path*"],
};
