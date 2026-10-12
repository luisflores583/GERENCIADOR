import Link from "next/link";
import { Casco } from "@/components/cabecalho";
import { SeloStatus } from "@/components/selo";
import { formatarDataHora, formatarMoeda } from "@/lib/formatacao";
import { ROTULO_FORMATO, ROTULO_FORMACAO, ROTULO_NAIPE } from "@/lib/rotulos";
import { prisma } from "@/server/db";
import { obterUsuario } from "@/server/sessao";

export const dynamic = "force-dynamic";

export default async function PaginaInicial() {
  const usuario = await obterUsuario();
  const torneios = await prisma.torneio.findMany({ orderBy: { inicioEm: "desc" } });
  return (
    <Casco nome={usuario?.nome} papel={usuario?.papel}>
      <section className="rounded-[2rem] bg-navy px-6 py-10 text-white shadow-card sm:px-10">
        <p className="text-sm uppercase tracking-[0.22em] text-white/70">Arena de areia</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl leading-tight sm:text-6xl">
          O torneio anda sozinho. Você registra o placar.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-white/80">
          Duplas, trios ou quartetos, com duas vidas, quadras e chave ao vivo para a televisão da arena.
        </p>
      </section>
      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {torneios.length === 0 ? <p>Nenhum torneio cadastrado ainda.</p> : null}
        {torneios.map((torneio) => (
          <article key={torneio.id} className="rounded-3xl bg-foam p-5 shadow-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-3xl text-navy">{torneio.nome}</h2>
              <SeloStatus status={torneio.status} />
            </div>
            <p className="mt-2 text-navy/75">
              {ROTULO_FORMATO[torneio.formato]} · {ROTULO_NAIPE[torneio.naipe]} · {ROTULO_FORMACAO[torneio.formacao]}
            </p>
            <p className="mt-1">{torneio.local}</p>
            <p className="mt-1">{formatarDataHora(torneio.inicioEm)}</p>
            <p className="mt-1">Inscrição {formatarMoeda(torneio.valorCentavos)}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link className="inline-flex min-h-14 items-center rounded-2xl bg-coral px-4 font-semibold text-white" href={`/ao-vivo/${torneio.slug}`}>
                Ver ao vivo
              </Link>
              <Link className="inline-flex min-h-14 items-center rounded-2xl bg-white px-4 font-semibold text-navy" href={`/torneios/${torneio.slug}`}>
                Detalhes
              </Link>
            </div>
          </article>
        ))}
      </section>
    </Casco>
  );
}
