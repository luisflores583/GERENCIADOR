import { NextResponse, type NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const sessao = req.cookies.get("sessao")?.value;
  if (!sessao) {
    const url = req.nextUrl.clone();
    url.pathname = "/entrar";
    url.searchParams.set("proxima", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/atleta/:path*"],
};
