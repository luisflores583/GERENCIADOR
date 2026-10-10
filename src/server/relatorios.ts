import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import { ROTULO_PARTIDA, ROTULO_SITUACAO, ROTULO_STATUS } from "@/lib/rotulos";
import { formatarDataHora } from "@/lib/formatacao";
import type { PainelDTO } from "@/tipos";

function csv(valor: string | number | null | undefined): string {
  const texto = valor == null ? "" : String(valor);
  if (/[";\r\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function gerarCsv(painel: PainelDTO): string {
  const linhas: Array<Array<string | number | null | undefined>> = [
    ["Resumo do torneio"],
    ["Nome", painel.torneio.nome],
    ["Local", painel.torneio.local],
    ["Início", formatarDataHora(painel.torneio.inicioEm)],
    ["Status", ROTULO_STATUS[painel.torneio.status as keyof typeof ROTULO_STATUS] ?? painel.torneio.status],
    ["Campeão", painel.campeao ?? ""],
    ["Vice-campeão", painel.vice ?? ""],
    ["Partidas concluídas", String(painel.partidas.filter((partida) => partida.status === "CONCLUIDA").length)],
    [],
    ["Posição", "Equipe", "Integrantes", "Vitórias", "Derrotas", "Situação"],
    ...painel.classificacao.map((equipe) => [
      String(equipe.posicao),
      equipe.nome,
      equipe.membros.join(", "),
      String(equipe.vitorias),
      String(equipe.derrotas),
      ROTULO_SITUACAO[equipe.situacao],
    ]),
    [],
    ["Código", "Fase", "Chave", "Equipe A", "Placar A", "Placar B", "Equipe B", "Quadra", "Status", "Início", "Fim"],
    ...painel.partidas.map((partida) => [
      partida.codigo,
      partida.fase,
      partida.chave,
      partida.equipeA?.nome ?? "",
      partida.placarA ?? "",
      partida.placarB ?? "",
      partida.equipeB?.nome ?? "",
      partida.quadra ?? "",
      ROTULO_PARTIDA[partida.status as keyof typeof ROTULO_PARTIDA] ?? partida.status,
      partida.inicioEm ? formatarDataHora(partida.inicioEm) : "",
      partida.fimEm ? formatarDataHora(partida.fimEm) : "",
    ]),
  ];
  return `\uFEFF${linhas.map((linha) => linha.map(csv).join(";")).join("\r\n")}\r\n`;
}

function quebrar(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of palavras) {
    const candidato = atual ? `${atual} ${palavra}` : palavra;
    if (fonte.widthOfTextAtSize(candidato, tamanho) > largura && atual) {
      linhas.push(atual);
      atual = palavra;
    } else {
      atual = candidato;
    }
  }
  if (atual) linhas.push(atual);
  return linhas.length ? linhas : [""];
}

export async function gerarPdf(painel: PainelDTO): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  let pagina = doc.addPage([595, 842]);
  let y = 800;
  const escrever = (texto: string, tamanho = 11, destaque = false) => {
    const seguro = texto.replace(/[–—]/g, "-").replace(/[^\u0000-\u00FF]/g, "");
    for (const linha of quebrar(seguro, destaque ? negrito : fonte, tamanho, 515)) {
      if (y < 48) {
        pagina = doc.addPage([595, 842]);
        y = 800;
      }
      pagina.drawText(linha, {
        x: 40,
        y,
        size: tamanho,
        font: destaque ? negrito : fonte,
        color: rgb(0.05, 0.16, 0.28),
      });
      y -= tamanho + 5;
    }
  };

  escrever(painel.torneio.nome, 18, true);
  escrever(`${painel.torneio.modalidade} · ${painel.torneio.local}`, 12);
  escrever(`Início: ${formatarDataHora(painel.torneio.inicioEm)}`);
  if (painel.campeao) escrever(`Campeão: ${painel.campeao}`, 13, true);
  if (painel.vice) escrever(`Vice-campeão: ${painel.vice}`, 12);
  escrever(
    `Partidas concluídas: ${painel.partidas.filter((partida) => partida.status === "CONCLUIDA").length}`,
  );
  y -= 8;
  escrever("Classificação", 14, true);
  for (const equipe of painel.classificacao) {
    escrever(
      `${equipe.posicao}. ${equipe.nome} — ${equipe.membros.join(", ")} — ${equipe.vitorias} vitória(s), ${equipe.derrotas} derrota(s) — ${ROTULO_SITUACAO[equipe.situacao]}`,
    );
  }
  y -= 8;
  escrever("Partidas", 14, true);
  for (const partida of painel.partidas) {
    const placar =
      partida.placarA != null && partida.placarB != null ? `${partida.placarA} x ${partida.placarB}` : "x";
    escrever(
      `${partida.fase}: ${partida.equipeA?.nome ?? "Aguardando"} ${placar} ${partida.equipeB?.nome ?? "Aguardando"} — ${partida.quadra ?? "sem quadra"} — ${ROTULO_PARTIDA[partida.status as keyof typeof ROTULO_PARTIDA] ?? partida.status}`,
    );
  }
  escrever(`Gerado em ${formatarDataHora(painel.atualizadoEm)}.`);
  return doc.save();
}
