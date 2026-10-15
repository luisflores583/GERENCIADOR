import type { Naipe, Sexo } from "@/engine/naipe";
import { desambiguarNome, nomeAutomatico } from "@/engine/nomes";

export const ALGORITMO_SORTEIO = "mulberry32-v1";

export function mulberry32(semente: number): () => number {
  let estado = semente >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) | 0;
    let t = Math.imul(estado ^ (estado >>> 15), 1 | estado);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function embaralhar<T>(itens: readonly T[], semente: number): T[] {
  const rng = mulberry32(semente);
  const lista = [...itens];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const atual = lista[i]!;
    lista[i] = lista[j]!;
    lista[j] = atual;
  }
  return lista;
}

export function ordemDasCabecas(
  equipesNaOrdemDeConfirmacao: readonly { id: string }[],
  modelo: "GENERICA" | "FOLHA_16",
  semente: number,
): string[] {
  const ids = equipesNaOrdemDeConfirmacao.map((equipe) => equipe.id);
  if (modelo === "FOLHA_16") return ids;
  return embaralhar(ids, semente);
}

export type FormatoEquipe = "DUPLA" | "TRIO" | "QUARTETO";

export function tamanhoDaEquipe(formato: FormatoEquipe): number {
  if (formato === "DUPLA") return 2;
  if (formato === "TRIO") return 3;
  return 4;
}

export function validarElenco(
  formato: FormatoEquipe,
  quantidade: number,
  permitirIncompleta = false,
): { ok: true } | { ok: false; erro: string } {
  const esperado = tamanhoDaEquipe(formato);
  if (quantidade === esperado) return { ok: true };
  if (permitirIncompleta && quantidade > 0 && quantidade < esperado) return { ok: true };
  return {
    ok: false,
    erro: `A modalidade de ${formato.toLowerCase()} exige exatamente ${esperado} atletas por equipe.`,
  };
}

export interface EquipeSorteada {
  nome: string;
  atletaIds: string[];
  incompleta: boolean;
}

export type ResultadoSorteioEquipes =
  | {
      ok: true;
      semente: number;
      algoritmo: string;
      equipes: EquipeSorteada[];
      sobra: number;
    }
  | {
      ok: false;
      sobra: number;
      mensagem: string;
      alternativas: string[];
    };

const ALTERNATIVAS_SOBRA = [
  "Aguardar novas inscrições.",
  "Ajustar o limite de inscrições antes do sorteio.",
  "Autorizar explicitamente uma equipe incompleta, se o regulamento deste torneio permitir.",
];

export function sortearEquipes(entrada: {
  atletaIds: readonly string[];
  formato: FormatoEquipe;
  semente: number;
  autorizarIncompleta: boolean;
  nomes?: Readonly<Record<string, string>>;
  naipe?: Naipe;
  sexos?: Readonly<Record<string, Sexo>>;
}): ResultadoSorteioEquipes {
  const unicos = new Set(entrada.atletaIds);
  if (unicos.size !== entrada.atletaIds.length) {
    throw new Error("Há atletas repetidos na lista do sorteio.");
  }
  if (entrada.atletaIds.length === 0) {
    throw new Error("Não há atletas confirmados para o sorteio.");
  }

  const tamanho = tamanhoDaEquipe(entrada.formato);
  const sobra = entrada.atletaIds.length % tamanho;
  const equipesCompletas = Math.floor(entrada.atletaIds.length / tamanho);

  if ((sobra !== 0 || equipesCompletas === 0) && !entrada.autorizarIncompleta) {
    return {
      ok: false,
      sobra: sobra === 0 ? entrada.atletaIds.length : sobra,
      mensagem:
        equipesCompletas === 0
          ? `Há ${entrada.atletaIds.length} atleta(s) confirmado(s) e a modalidade exige ${tamanho}. Ninguém foi excluído.`
          : `Sobraram ${sobra} atleta(s) para formar equipes de ${tamanho}. Ninguém foi excluído e o sorteio não foi iniciado.`,
      alternativas: ALTERNATIVAS_SOBRA,
    };
  }

  const equipesPrevistas = equipesCompletas + (sobra !== 0 && entrada.autorizarIncompleta ? 1 : 0);
  const mulheres = entrada.atletaIds.filter((id) => entrada.sexos?.[id] === "FEMININO");
  if (entrada.naipe === "MISTO" && entrada.sexos && mulheres.length < equipesPrevistas) {
    return {
      ok: false,
      sobra: equipesPrevistas - mulheres.length,
      mensagem: `O misto precisa de pelo menos uma atleta feminina em cada equipe. Há ${mulheres.length} mulher(es) para ${equipesPrevistas} equipe(s). Ninguém foi excluído e o sorteio não foi iniciado.`,
      alternativas: ALTERNATIVAS_SOBRA,
    };
  }

  const ordem = entrada.naipe === "MISTO" && entrada.sexos
    ? ordemMista(entrada.atletaIds, entrada.sexos, entrada.semente, tamanho, equipesCompletas, sobra)
    : embaralhar(entrada.atletaIds, entrada.semente);
  const equipes: EquipeSorteada[] = [];
  const nomeDoGrupo = (ids: string[], indice: number) => {
    const nomes = ids.map((id) => entrada.nomes?.[id]?.trim() ?? "").filter(Boolean);
    const base = nomes.length === ids.length ? nomeAutomatico(nomes) : `Equipe ${String(indice).padStart(2, "0")}`;
    return desambiguarNome(base, equipes.map((equipe) => equipe.nome));
  };
  for (let i = 0; i < equipesCompletas; i++) {
    const atletaIds = ordem.slice(i * tamanho, (i + 1) * tamanho);
    equipes.push({
      nome: nomeDoGrupo(atletaIds, i + 1),
      atletaIds,
      incompleta: false,
    });
  }
  if (sobra !== 0 && entrada.autorizarIncompleta) {
    const atletaIds = ordem.slice(equipesCompletas * tamanho);
    equipes.push({
      nome: nomeDoGrupo(atletaIds, equipesCompletas + 1),
      atletaIds,
      incompleta: true,
    });
  }

  return {
    ok: true,
    semente: entrada.semente,
    algoritmo: ALGORITMO_SORTEIO,
    equipes,
    sobra,
  };
}

function ordemMista(
  atletaIds: readonly string[],
  sexos: Readonly<Record<string, Sexo>>,
  semente: number,
  tamanho: number,
  equipesCompletas: number,
  sobra: number,
): string[] {
  const mulheres = embaralhar(atletaIds.filter((id) => sexos[id] === "FEMININO"), semente);
  const demais = embaralhar(atletaIds.filter((id) => sexos[id] !== "FEMININO"), semente + 1);
  const times = equipesCompletas + (sobra !== 0 ? 1 : 0);
  const grupos = Array.from({ length: times }, () => [] as string[]);
  for (let indice = 0; indice < times; indice++) grupos[indice]!.push(mulheres[indice]!);
  const fila = [...mulheres.slice(times), ...demais];
  let cursor = 0;
  for (let indice = 0; indice < times; indice++) {
    const alvo = indice < equipesCompletas ? tamanho : sobra;
    while (grupos[indice]!.length < alvo) grupos[indice]!.push(fila[cursor++]!);
  }
  return grupos.flat();
}
