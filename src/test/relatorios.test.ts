import { describe, expect, it } from "vitest";
import { gerarCsv, gerarPdf } from "@/server/relatorios";
import type { PainelDTO } from "@/tipos";

function painel(): PainelDTO {
  return {
    torneio: {
      id: "t1",
      nome: "Arena da Orla",
      slug: "arena-da-orla",
      descricao: "",
      regulamento: "",
      local: "Orla",
      modalidade: "Vôlei de areia",
      formato: "DUPLA",
      formacao: "PRE_FORMADAS",
      naipe: "MISTO",
      status: "EM_ANDAMENTO",
      inicioEm: "2026-11-15T12:00:00.000Z",
      inscricoesAte: "2026-11-14T21:00:00.000Z",
      corDestaque: "#e36a3a",
      nomeOrganizador: "Areia Viva",
      pontosParaVencer: 21,
      diferencaMinima: 2,
      pontosMaximos: null,
      quadrasSimultaneas: 2,
      valorCentavos: 5000,
      atletasConfirmados: 4,
    },
    contagens: { equipes: 2, emDisputa: 2, eliminadas: 0 },
    equipes: [],
    partidas: [
      {
        id: "p1",
        codigo: "V1-0",
        chave: "VENCEDORES",
        rodada: 1,
        posicao: 0,
        fase: "Vencedores · rodada 1",
        equipeA: { id: "a", nome: "Maré Alta", situacao: "INVICTA" },
        equipeB: { id: "b", nome: "Vento Sul", situacao: "UMA_DERROTA" },
        placarA: 21,
        placarB: 18,
        status: "CONCLUIDA",
        quadra: "Quadra 1",
        quadraId: "q1",
        inicioEm: "2026-11-15T12:00:00.000Z",
        fimEm: "2026-11-15T12:40:00.000Z",
        aguardandoAdversario: false,
      },
    ],
    quadras: [],
    fila: [],
    classificacao: [
      {
        id: "a",
        nome: "Maré Alta",
        vitorias: 1,
        derrotas: 0,
        situacao: "INVICTA",
        membros: ["Ana Lima", "Bia Costa"],
        cabeca: 1,
        posicao: 1,
      },
    ],
    campeao: null,
    vice: null,
    atualizadoEm: "2026-11-15T12:40:00.000Z",
  };
}

describe("exportação do resumo", () => {
  it("gera CSV com separador ponto e vírgula e campeão vazio", () => {
    const csv = gerarCsv(painel());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("Arena da Orla");
    expect(csv).toContain("Maré Alta;Ana Lima, Bia Costa;1;0;Invicta");
    expect(csv).toContain("V1-0");
    expect(csv).toContain("21;18");
  });

  it("gera um PDF com conteúdo", async () => {
    const pdf = await gerarPdf(painel());
    expect(pdf.byteLength).toBeGreaterThan(500);
    expect(Buffer.from(pdf.subarray(0, 4)).toString()).toBe("%PDF");
  });
});
