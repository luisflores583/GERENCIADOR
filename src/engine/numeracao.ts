import {
  nomeDaFase,
  rodadasDaChaveDeVencedores,
  type LadoChave,
  type ModeloChave,
  type Origem,
} from "@/engine/dupla-eliminacao";
import { rotuloDaPartida } from "@/engine/folha-16";
import { rotuloDaPartida32, textoDaVaga } from "@/engine/folha-32";

export type ClasseEstrutural = "REAL" | "FOLGA" | "VAZIA";
export type LadoNumeracao = "ABERTURA" | "VENCEDORES" | "PERDEDORES" | "FINAL";

export type PartidaNumeravel = {
  id?: string;
  codigo?: string;
  chave: LadoChave;
  rodada: number;
  posicao: number;
  origemA: Origem;
  origemB: Origem;
  equipeAId?: string | null;
  equipeBId?: string | null;
  status?: string;
};

export type ApresentacaoPartida = {
  codigo: string;
  numero: number | null;
  classe: ClasseEstrutural;
  lado: LadoNumeracao;
  aparece: boolean;
  rotulo: string;
  vagaA: string | null;
  vagaB: string | null;
};

export type ChaveApresentada = {
  cheia: boolean;
  porCodigo: Map<string, ApresentacaoPartida>;
};

export function codigoDaPartida(partida: Pick<PartidaNumeravel, "id" | "codigo">): string {
  return partida.codigo ?? partida.id ?? "";
}

export function comoOrigem(valor: unknown): Origem {
  if (!valor || typeof valor !== "object" || !("tipo" in valor)) return { tipo: "BYE" };
  return valor as Origem;
}

function dependencias(partida: PartidaNumeravel): string[] {
  return [partida.origemA, partida.origemB].flatMap((origem) =>
    origem.tipo === "VENCEDOR" || origem.tipo === "PERDEDOR" ? [origem.partidaId] : [],
  );
}

function ondaDa(
  partida: PartidaNumeravel,
  porCodigo: Map<string, PartidaNumeravel>,
  memo: Map<string, number>,
  visitando: Set<string>,
): number {
  const codigo = codigoDaPartida(partida);
  const pronta = memo.get(codigo);
  if (pronta != null) return pronta;
  if (visitando.has(codigo)) return 0;
  visitando.add(codigo);
  const anteriores = dependencias(partida);
  const onda =
    anteriores.length === 0
      ? 0
      : 1 +
        Math.max(
          ...anteriores.map((id) => {
            const fonte = porCodigo.get(id);
            return fonte ? ondaDa(fonte, porCodigo, memo, visitando) : 0;
          }),
        );
  visitando.delete(codigo);
  memo.set(codigo, onda);
  return onda;
}

function produz(origem: Origem, classe: Map<string, ClasseEstrutural>, quantidade: number): boolean {
  if (origem.tipo === "CABECA") return origem.cabeca >= 1 && origem.cabeca <= quantidade;
  if (origem.tipo === "BYE" || origem.tipo === "SEM_PONTEIRO") return false;
  const origemClasse = classe.get(origem.partidaId);
  if (!origemClasse) return false;
  if (origem.tipo === "VENCEDOR") return origemClasse === "REAL" || origemClasse === "FOLGA";
  return origemClasse === "REAL";
}

function classeDa(partida: PartidaNumeravel, classe: Map<string, ClasseEstrutural>, quantidade: number): ClasseEstrutural {
  const a = produz(partida.origemA, classe, quantidade);
  const b = produz(partida.origemB, classe, quantidade);
  if (a && b) return "REAL";
  if (a || b) return "FOLGA";
  return "VAZIA";
}

function semente(origem: Origem): boolean {
  return origem.tipo === "CABECA" || origem.tipo === "BYE";
}

function caminhoDeVencedores(origem: Origem, lado: Map<string, LadoNumeracao>): boolean {
  if (origem.tipo !== "VENCEDOR") return false;
  const origemLado = lado.get(origem.partidaId);
  return origemLado === "ABERTURA" || origemLado === "VENCEDORES";
}

function ladoDa(partida: PartidaNumeravel, lado: Map<string, LadoNumeracao>): LadoNumeracao {
  if (partida.chave === "FINAL" || partida.chave === "FINAL_EXTRA" || partida.chave === "SEMIFINAL") return "FINAL";
  if (semente(partida.origemA) && semente(partida.origemB)) return "ABERTURA";
  if (partida.chave === "VENCEDORES") return "VENCEDORES";
  if (partida.chave === "PERDEDORES") return "PERDEDORES";
  if (caminhoDeVencedores(partida.origemA, lado) && caminhoDeVencedores(partida.origemB, lado)) return "VENCEDORES";
  return "PERDEDORES";
}

function ordenar(partidas: PartidaNumeravel[], modelo: ModeloChave): PartidaNumeravel[] {
  const rank = (chave: LadoChave) => (chave === "VENCEDORES" ? 0 : chave === "PERDEDORES" ? 1 : chave === "FINAL" ? 2 : 3);
  return [...partidas].sort((a, b) => {
    if (modelo === "GENERICA") {
      return rank(a.chave) - rank(b.chave) || a.rodada - b.rodada || a.posicao - b.posicao;
    }
    return Number(codigoDaPartida(a)) - Number(codigoDaPartida(b)) || a.posicao - b.posicao;
  });
}

function origemQueProduz(partida: PartidaNumeravel, classe: Map<string, ClasseEstrutural>, quantidade: number): Origem | null {
  const a = produz(partida.origemA, classe, quantidade);
  const b = produz(partida.origemB, classe, quantidade);
  if (a && !b) return partida.origemA;
  if (b && !a) return partida.origemB;
  return null;
}

function textoDaOrigem(
  origem: Origem,
  classe: Map<string, ClasseEstrutural>,
  numero: Map<string, number>,
  porCodigo: Map<string, PartidaNumeravel>,
  quantidade: number,
  visitando: Set<string>,
): string | null {
  if (origem.tipo !== "VENCEDOR" && origem.tipo !== "PERDEDOR") return textoDaVaga(origem);
  const fonte = porCodigo.get(origem.partidaId);
  const origemClasse = classe.get(origem.partidaId);
  if (!fonte || !origemClasse) return null;
  if (origemClasse === "REAL") {
    const exibido = numero.get(origem.partidaId);
    if (exibido == null) return null;
    return `${origem.tipo === "VENCEDOR" ? "vencedor" : "perdedor"} do jogo ${exibido}`;
  }
  if (origem.tipo === "VENCEDOR" && origemClasse === "FOLGA") {
    if (visitando.has(origem.partidaId)) return null;
    const continua = origemQueProduz(fonte, classe, quantidade);
    if (!continua) return null;
    visitando.add(origem.partidaId);
    const texto = textoDaOrigem(continua, classe, numero, porCodigo, quantidade, visitando);
    visitando.delete(origem.partidaId);
    return texto;
  }
  return null;
}

function rotuloDe(
  partida: PartidaNumeravel,
  modelo: ModeloChave,
  classe: ClasseEstrutural,
  numero: number | null,
  cheia: boolean,
  rodadas: number,
): string {
  if (classe === "FOLGA") return "Folga";
  const codigo = codigoDaPartida(partida);
  if (!cheia && numero != null) {
    if (modelo === "FOLHA_16") return rotuloDaPartida(codigo, partida.chave, String(numero));
    if (modelo === "FOLHA_32") return rotuloDaPartida32(codigo, partida.chave, String(numero));
    return `Jogo ${numero} · ${nomeDaFase(partida.chave, partida.rodada, rodadas)}`;
  }
  if (modelo === "FOLHA_16") return rotuloDaPartida(codigo, partida.chave);
  if (modelo === "FOLHA_32") return rotuloDaPartida32(codigo, partida.chave);
  return nomeDaFase(partida.chave, partida.rodada, rodadas);
}

export function apresentarChave(
  partidas: readonly PartidaNumeravel[],
  quantidade: number,
  modelo: ModeloChave,
): ChaveApresentada {
  const ordenadas = ordenar([...partidas], modelo);
  const porCodigo = new Map(ordenadas.map((partida) => [codigoDaPartida(partida), partida]));
  const ondas = new Map<string, number>();
  for (const partida of ordenadas) ondaDa(partida, porCodigo, ondas, new Set());

  const maxOnda = Math.max(0, ...ondas.values());
  const classe = new Map<string, ClasseEstrutural>();
  const lado = new Map<string, LadoNumeracao>();
  for (let onda = 0; onda <= maxOnda; onda++) {
    for (const partida of ordenadas) {
      if ((ondas.get(codigoDaPartida(partida)) ?? 0) !== onda) continue;
      const codigo = codigoDaPartida(partida);
      classe.set(codigo, classeDa(partida, classe, quantidade));
      lado.set(codigo, ladoDa(partida, lado));
    }
  }

  const cheia = ordenadas.every((partida) => classe.get(codigoDaPartida(partida)) === "REAL");
  const numero = new Map<string, number>();
  if (cheia && modelo !== "GENERICA") {
    for (const partida of ordenadas) {
      const codigo = codigoDaPartida(partida);
      const valor = Number(codigo);
      if (Number.isFinite(valor)) numero.set(codigo, valor);
    }
  } else if (!cheia) {
    let proximo = 1;
    const marcar = (partida: PartidaNumeravel) => {
      if (classe.get(codigoDaPartida(partida)) !== "REAL") return;
      numero.set(codigoDaPartida(partida), proximo);
      proximo += 1;
    };
    for (const partida of ordenadas) {
      if (lado.get(codigoDaPartida(partida)) === "ABERTURA") marcar(partida);
    }
    for (let onda = 1; onda <= maxOnda; onda++) {
      const daOnda = ordenadas.filter((partida) => (ondas.get(codigoDaPartida(partida)) ?? 0) === onda);
      const vencedores = daOnda.filter((partida) => lado.get(codigoDaPartida(partida)) === "VENCEDORES");
      const perdedores = daOnda.filter((partida) => lado.get(codigoDaPartida(partida)) === "PERDEDORES");
      const finais = daOnda.filter((partida) => lado.get(codigoDaPartida(partida)) === "FINAL");
      const pares = Math.max(vencedores.length, perdedores.length);
      for (let indice = 0; indice < pares; indice++) {
        const doVencedor = vencedores[indice];
        const doPerdedor = perdedores[indice];
        if (doVencedor) marcar(doVencedor);
        if (doPerdedor) marcar(doPerdedor);
      }
      for (const partida of finais) marcar(partida);
    }
  }

  const rodadas = rodadasDaChaveDeVencedores(Math.max(2, quantidade));
  const porApresentacao = new Map<string, ApresentacaoPartida>();
  for (const partida of ordenadas) {
    const codigo = codigoDaPartida(partida);
    const classePartida = classe.get(codigo) ?? "VAZIA";
    const ladoPartida = lado.get(codigo) ?? "FINAL";
    const numeroPartida = numero.get(codigo) ?? null;
    const temTime = Boolean(partida.equipeAId || partida.equipeBId);
    const aparece =
      partida.status !== "VAZIA" &&
      partida.status !== "NAO_NECESSARIA" &&
      classePartida !== "VAZIA" &&
      (classePartida === "REAL" || temTime || partida.status === "BYE");
    porApresentacao.set(codigo, {
      codigo,
      numero: numeroPartida,
      classe: classePartida,
      lado: ladoPartida,
      aparece,
      rotulo: rotuloDe(partida, modelo, classePartida, numeroPartida, cheia, rodadas),
      vagaA: textoDaOrigem(partida.origemA, classe, numero, porCodigo, quantidade, new Set()),
      vagaB: textoDaOrigem(partida.origemB, classe, numero, porCodigo, quantidade, new Set()),
    });
  }

  return { cheia, porCodigo: porApresentacao };
}

export function rotuloAdmin(modelo: ModeloChave, cheia: boolean, partida: PartidaNumeravel, apresentacao: ApresentacaoPartida, quantidade: number): string {
  if (modelo === "GENERICA" && cheia) {
    const rodadas = rodadasDaChaveDeVencedores(Math.max(2, quantidade));
    return `${nomeDaFase(partida.chave, partida.rodada, rodadas)} · ${codigoDaPartida(partida)}`;
  }
  return apresentacao.rotulo;
}
