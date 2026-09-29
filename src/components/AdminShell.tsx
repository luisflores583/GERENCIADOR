"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/agenda", label: "Agenda" },
  { href: "/clientes", label: "Clientes" },
  { href: "/servicos", label: "Serviços" },
  { href: "/horarios", label: "Horários" },
  { href: "/bloqueios", label: "Bloqueios" },
  { href: "/financeiro", label: "Financeiro" },
  { href: "/relatorios", label: "Relatórios" },
  { href: "/whatsapp", label: "WhatsApp" },
  { href: "/configuracoes", label: "Configurações" },
];

export function AdminShell({
  children,
  userName,
}: {
  children: React.ReactNode;
  userName: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transform border-r border-[#e8e0dc] bg-[#fffaf9]/90 backdrop-blur transition lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-5">
          <Link href="/dashboard" className="font-display text-2xl text-blush-700">
            Manicure
          </Link>
          <button
            className="rounded-lg p-2 text-ink-700 lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fechar menu"
          >
            ✕
          </button>
        </div>
        <nav className="space-y-0.5 px-3 pb-8">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`block rounded-xl px-3 py-2.5 text-sm transition ${
                  active
                    ? "bg-blush-100 font-medium text-blush-800"
                    : "text-ink-700 hover:bg-blush-50"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t border-[#e8e0dc] p-4">
          <p className="truncate text-sm font-medium">{userName}</p>
          <button onClick={logout} className="mt-2 text-xs text-blush-700 underline">
            Sair
          </button>
        </div>
      </aside>

      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-label="Fechar"
        />
      )}

      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-[#e8e0dc] bg-[#faf6f4]/90 px-4 backdrop-blur lg:h-16 lg:px-8">
          <button
            className="rounded-lg border border-[#e8e0dc] bg-white px-3 py-1.5 text-sm lg:hidden"
            onClick={() => setOpen(true)}
          >
            Menu
          </button>
          <p className="font-display text-lg text-blush-700 lg:hidden">Manicure</p>
        </header>
        <main className="flex-1 px-4 py-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
