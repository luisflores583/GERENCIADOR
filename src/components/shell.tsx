"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/actions/auth";

const LINKS = [
  { href: "/inicio", label: "Início" },
  { href: "/atletas", label: "Atletas" },
  { href: "/dupla", label: "Dupla", badgeKey: "invites" as const },
  { href: "/desafios", label: "Desafios", badgeKey: "challenges" as const },
  { href: "/agenda", label: "Agenda" },
];

export function Shell({
  name,
  invites,
  challenges,
  children,
}: {
  name: string;
  invites: number;
  challenges: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const badges = { invites, challenges };

  return (
    <div className="arena-bg min-h-screen">
      <div className="h-1.5 bg-ink" />
      <header className="border-b border-line/80 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/inicio" className="font-display text-xl font-semibold tracking-tight">
            Ache sua dupla
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {LINKS.map((link) => (
              <NavLink key={link.href} link={link} pathname={pathname} count={link.badgeKey ? badges[link.badgeKey] : 0} />
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/perfil" className={`btn-ghost hidden sm:inline-flex ${pathname === "/perfil" ? "border-ink" : ""}`}>
              {name.split(" ")[0]}
            </Link>
            <Link href="/perfil" className="btn-ghost sm:hidden">
              Perfil
            </Link>
            <form action={logoutAction}>
              <button className="btn-ghost" type="submit">
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex max-w-6xl flex-col gap-5 px-4 pb-28 pt-6 md:pb-16">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-paper/95 px-2 py-2 backdrop-blur md:hidden">
        <ul className="grid grid-cols-5 gap-1">
          {LINKS.map((link) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            const count = link.badgeKey ? badges[link.badgeKey] : 0;
            return (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={`relative flex flex-col items-center rounded-2xl px-1 py-2 text-[11px] font-semibold ${active ? "bg-ink text-lime" : "text-ink/70"}`}
                >
                  {link.label}
                  {count > 0 && (
                    <span className="absolute right-2 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-clay px-1 text-[10px] text-white">
                      {count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function NavLink({
  link,
  pathname,
  count,
}: {
  link: (typeof LINKS)[number];
  pathname: string;
  count: number;
}) {
  const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
  return (
    <Link
      href={link.href}
      className={`relative rounded-full px-3 py-2 text-sm font-semibold ${active ? "bg-ink text-lime" : "text-ink/70 hover:bg-sand"}`}
    >
      {link.label}
      {count > 0 && (
        <span className="ml-1 inline-grid h-5 min-w-5 place-items-center rounded-full bg-clay px-1 text-[10px] text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
