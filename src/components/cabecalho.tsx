import Link from "next/link";
import { acaoSair } from "@/server/acoes";

export function Marca() {
  return (
    <span className="flex items-center">
      <img src="/setpoint-santiago-logo.png" alt="SetPoint Santiago" className="h-24 w-auto" />
    </span>
  );
}

export function Cabecalho({
  nome,
  papel,
}: {
  nome?: string | null;
  papel?: "ADMIN" | "ATLETA" | null;
}) {
  return (
    <header className="border-b border-navy/10 bg-foam/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="rounded-xl">
          <Marca />
        </Link>
        <nav className="flex flex-wrap items-center gap-2 text-base" aria-label="Principal">
          <Link className="min-h-14 rounded-2xl px-4 py-3 font-semibold text-navy hover:bg-white" href="/">
            Torneios
          </Link>
          {papel === "ADMIN" ? (
            <Link className="min-h-14 rounded-2xl px-4 py-3 font-semibold text-navy hover:bg-white" href="/admin">
              Painel
            </Link>
          ) : null}
          {papel === "ATLETA" ? (
            <Link className="min-h-14 rounded-2xl px-4 py-3 font-semibold text-navy hover:bg-white" href="/atleta">
              Minha área
            </Link>
          ) : null}
          {nome ? (
            <form action={acaoSair}>
              <button className="min-h-14 rounded-2xl px-4 py-3 font-semibold text-navy hover:bg-white" type="submit">
                Sair
              </button>
            </form>
          ) : (
            <>
              <Link className="min-h-14 rounded-2xl px-4 py-3 font-semibold text-navy hover:bg-white" href="/entrar">
                Entrar
              </Link>
              <Link className="inline-flex min-h-14 items-center rounded-2xl bg-coral px-4 py-3 font-semibold text-white" href="/cadastro">
                Criar conta
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export function Casco({
  children,
  nome,
  papel,
}: {
  children: React.ReactNode;
  nome?: string | null;
  papel?: "ADMIN" | "ATLETA" | null;
}) {
  return (
    <>
      <Cabecalho nome={nome} papel={papel} />
      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-8">
        {children}
      </main>
    </>
  );
}
