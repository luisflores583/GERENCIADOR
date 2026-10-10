import Link from "next/link";
import { notFound } from "next/navigation";
import { Casco } from "@/components/cabecalho";
import { SeloStatus } from "@/components/selo";
import { formatarDataHora, formatarMoeda } from "@/lib/formatacao";
import { ROTULO_FORMATO, ROTULO_FORMACAO } from "@/lib/rotulos";
import { montarPainel } from "@/server/consultas";
import { obterUsuario } from "@/server/sessao";

export const dynamic = "force-dynamic";

export default async function PaginaTorneio({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [painel, usuario] = await Promise.all([montarPainel(slug), obterUsuario()]);
  if (!painel) notFound();
  return (
    <Casco nome={usuario?.nome} papel={usuario?.papel}>
      <article className="rounded-[2rem] bg-foam p-6 shadow-card">
        <SeloStatus status={painel.torneio.status} />
        <h1 className="mt-3 font-display text-5xl text-navy">{painel.torneio.nome}</h1>
        <p className="mt-3 text-lg">{painel.torneio.descricao}</p>
        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div><dt className="text-sm text-navy/60">Quando</dt><dd>{formatarDataHora(painel.torneio.inicioEm)}</dd></div>
          <div><dt className="text-sm text-navy/60">Local</dt><dd>{painel.torneio.local}</dd></div>
          <div><dt className="text-sm text-navy/60">Formato</dt><dd>{ROTULO_FORMATO[painel.torneio.formato]}</dd></div>
          <div><dt className="text-sm text-navy/60">Equipes</dt><dd>{ROTULO_FORMACAO[painel.torneio.formacao]}</dd></div>
          <div><dt className="text-sm text-navy/60">Inscrições até</dt><dd>{formatarDataHora(painel.torneio.inscricoesAte)}</dd></div>
          <div><dt className="text-sm text-navy/60">Valor</dt><dd>{formatarMoeda(painel.torneio.valorCentavos)}</dd></div>
          <div><dt className="text-sm text-navy/60">Placar</dt><dd>{painel.torneio.pontosParaVencer} pontos, diferença {painel.torneio.diferencaMinima}{painel.torneio.pontosMaximos ? `, teto ${painel.torneio.pontosMaximos}` : ""}</dd></div>
        </dl>
        {painel.torneio.regulamento ? (
          <section className="mt-6">
            <h2 className="font-display text-2xl">Regulamento</h2>
            <p className="mt-2 whitespace-pre-wrap">{painel.torneio.regulamento}</p>
          </section>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link className="inline-flex min-h-14 items-center rounded-2xl bg-coral px-5 font-semibold text-white" href={`/ao-vivo/${painel.torneio.slug}`}>
            Acompanhar ao vivo
          </Link>
          {usuario?.papel === "ATLETA" ? (
            <Link className="inline-flex min-h-14 items-center rounded-2xl bg-navy px-5 font-semibold text-white" href={`/atleta/torneios/${painel.torneio.id}`}>
              Minha inscrição
            </Link>
          ) : null}
        </div>
      </article>
    </Casco>
  );
}
