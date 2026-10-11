import Link from "next/link";
import { notFound } from "next/navigation";
import { Botao } from "@/components/botao";
import { CamposTorneio } from "@/components/campos-torneio";
import { Formulario } from "@/components/formulario";
import { MenuTorneio } from "@/components/menu-torneio";
import { SeloStatus } from "@/components/selo";
import { formatarMoeda, paraCampoDataHora } from "@/lib/formatacao";
import { ROTULO_FORMATO } from "@/lib/rotulos";
import { acaoAtualizarTorneio, acaoStatus } from "@/server/acoes";
import { prisma } from "@/server/db";

export default async function VisaoTorneio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const torneio = await prisma.torneio.findUnique({
    where: { id },
    include: { _count: { select: { equipes: true, inscricoes: true, partidas: true } } },
  });
  if (!torneio) notFound();
  const valor = torneio.valorCentavos == null ? "" : (torneio.valorCentavos / 100).toFixed(2).replace(".", ",");
  const acoes = [
    ["preparar", "Preparar sorteio"],
    ["encerrar", "Encerrar inscrições"],
    ["reabrir", "Reabrir inscrições"],
    ["pausar", "Pausar torneio"],
    ["retomar", "Retomar torneio"],
  ] as const;
  return (
    <div>
      <MenuTorneio id={torneio.id} slug={torneio.slug} />
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl text-navy">{torneio.nome}</h1>
        <SeloStatus status={torneio.status} />
      </div>
      <p className="mt-2 text-navy/70">
        {ROTULO_FORMATO[torneio.formato]} · {torneio._count.inscricoes} inscrições · {torneio._count.equipes} equipes · inscrição {formatarMoeda(torneio.valorCentavos)}
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link className="inline-flex min-h-14 items-center rounded-2xl bg-coral px-5 font-semibold text-white" href={`/admin/torneios/${torneio.id}/jogos`}>
          Registrar resultado
        </Link>
        <Link className="inline-flex min-h-14 items-center rounded-2xl bg-navy px-5 font-semibold text-white" href={`/admin/torneios/${torneio.id}/inscricoes`}>
          Inscrever atleta
        </Link>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {acoes.map(([acao, rotulo]) => (
          <Formulario key={acao} acao={acaoStatus} className="w-auto">
            <input type="hidden" name="torneioId" value={torneio.id} />
            <input type="hidden" name="acao" value={acao} />
            <Botao type="submit" variante="secundario">{rotulo}</Botao>
          </Formulario>
        ))}
      </div>
      <Formulario acao={acaoAtualizarTorneio} className="mt-8 rounded-[2rem] bg-foam p-6 shadow-card">
        <input type="hidden" name="torneioId" value={torneio.id} />
        <h2 className="font-display text-2xl">Configuração</h2>
        <CamposTorneio
          valores={{
            nome: torneio.nome,
            descricao: torneio.descricao,
            regulamento: torneio.regulamento,
            inicioEm: paraCampoDataHora(torneio.inicioEm),
            local: torneio.local,
            formato: torneio.formato,
            formacao: torneio.formacao,
            maxAtletas: torneio.maxAtletas,
            inscricoesAte: paraCampoDataHora(torneio.inscricoesAte),
            valorReais: valor,
            pontosParaVencer: torneio.pontosParaVencer,
            diferencaMinima: torneio.diferencaMinima,
            pontosMaximos: torneio.pontosMaximos,
            quadrasSimultaneas: torneio.quadrasSimultaneas,
            descansoMinutos: torneio.descansoMinutos,
            permitirEquipeIncompleta: torneio.permitirEquipeIncompleta,
            corDestaque: torneio.corDestaque,
            nomeOrganizador: torneio.nomeOrganizador,
            travado: Boolean(torneio.equipesTravadasEm),
          }}
        />
        <Botao type="submit">Salvar alterações</Botao>
      </Formulario>
    </div>
  );
}
