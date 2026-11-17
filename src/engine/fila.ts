export type LadoDaFila = "VENCEDORES" | "PERDEDORES" | "OUTRO";

export type PartidaDaFila = {
  id: string;
  chave: string;
  origemA: unknown;
  origemB: unknown;
};

export type ItemOrdenado = {
  id: string;
  prontaEm: number;
  rodada: number;
  ordem: number;
  lado: LadoDaFila;
};

export type EntradaDaFila = {
  id: string;
  codigo: string;
  chave: string;
  rodada: number;
  posicao: number;
  origemA: unknown;
  origemB: unknown;
  status: string;
  equipeAId: string | null;
  equipeBId: string | null;
  prontaEm: number;
  inicioEm: number | null;
  fimEm: number | null;
};

const OCUPANDO = new Set(["AGENDADA", "EM_ANDAMENTO", "PAUSADA"]);

function lerOrigem(valor: unknown): { tipo: string; partidaId?: string } {
  if (!valor || typeof valor !== "object" || !("tipo" in valor)) return { tipo: "" };
  const tipo = String((valor as { tipo: unknown }).tipo);
  const bruto = (valor as { partidaId?: unknown }).partidaId;
  return { tipo, partidaId: bruto == null ? undefined : String(bruto) };
}

export function classificarLados(partidas: readonly PartidaDaFila[]): Map<string, LadoDaFila> {
  const porId = new Map(partidas.map((partida) => [partida.id, partida]));
  const memo = new Map<string, LadoDaFila>();

  function lado(id: string): LadoDaFila {
    const pronto = memo.get(id);
    if (pronto) return pronto;
    const partida = porId.get(id);
    if (!partida) {
      memo.set(id, "OUTRO");
      return "OUTRO";
    }
    memo.set(id, "OUTRO");
    const calculado = calcular(partida);
    memo.set(id, calculado);
    return calculado;
  }

  function calcular(partida: PartidaDaFila): LadoDaFila {
    if (partida.chave === "FINAL" || partida.chave === "FINAL_EXTRA" || partida.chave === "SEMIFINAL") {
      return "OUTRO";
    }
    if (partida.chave === "VENCEDORES") return "VENCEDORES";
    if (partida.chave === "PERDEDORES") return "PERDEDORES";

    const origens = [lerOrigem(partida.origemA), lerOrigem(partida.origemB)];
    if (origens.every((origem) => origem.tipo === "CABECA" || origem.tipo === "BYE")) return "VENCEDORES";
    if (origens.some((origem) => origem.tipo === "PERDEDOR")) return "PERDEDORES";

    const alimentadores = origens.filter((origem) => origem.tipo === "VENCEDOR" && origem.partidaId);
    if (alimentadores.length > 0 && alimentadores.every((origem) => lado(origem.partidaId!) === "VENCEDORES")) {
      return "VENCEDORES";
    }
    return "PERDEDORES";
  }

  for (const partida of partidas) lado(partida.id);
  return memo;
}

export function ordemNaFolha(codigo: string, posicao: number): number {
  const numero = Number(codigo);
  return Number.isFinite(numero) && numero > 0 ? numero : posicao;
}

export function compararEspera(a: ItemOrdenado, b: ItemOrdenado): number {
  return a.prontaEm - b.prontaEm || a.rodada - b.rodada || a.ordem - b.ordem || a.id.localeCompare(b.id);
}

export function partidaEntraNaFila(status: string, equipeAId: string | null, equipeBId: string | null): boolean {
  return status === "PRONTA" && Boolean(equipeAId) && Boolean(equipeBId);
}

export function escolherInicio(
  vencedores: readonly ItemOrdenado[],
  perdedores: readonly ItemOrdenado[],
  ocupando: readonly { lado: LadoDaFila }[],
  ultimoLado: LadoDaFila | null,
): "VENCEDORES" | "PERDEDORES" | null {
  if (vencedores.length === 0 && perdedores.length === 0) return null;
  if (vencedores.length === 0) return "PERDEDORES";
  if (perdedores.length === 0) return "VENCEDORES";

  const emQuadraV = ocupando.filter((item) => item.lado === "VENCEDORES").length;
  const emQuadraP = ocupando.filter((item) => item.lado === "PERDEDORES").length;
  if (emQuadraV > emQuadraP) return "PERDEDORES";
  if (emQuadraP > emQuadraV) return "VENCEDORES";
  if (ultimoLado === "VENCEDORES") return "PERDEDORES";
  if (ultimoLado === "PERDEDORES") return "VENCEDORES";
  return vencedores[0]!.prontaEm <= perdedores[0]!.prontaEm ? "VENCEDORES" : "PERDEDORES";
}

export function ordenarFila<T extends ItemOrdenado>(itens: readonly T[], inicio: "VENCEDORES" | "PERDEDORES" | null): T[] {
  const vencedores = itens.filter((item) => item.lado === "VENCEDORES").sort(compararEspera);
  const perdedores = itens.filter((item) => item.lado === "PERDEDORES").sort(compararEspera);
  const outros = itens.filter((item) => item.lado === "OUTRO").sort(compararEspera);
  const comeco = inicio ?? escolherInicio(vencedores, perdedores, [], null);

  const alternada: T[] = [];
  let indiceV = 0;
  let indiceP = 0;
  let proximo = comeco;
  while (indiceV < vencedores.length || indiceP < perdedores.length) {
    const soVencedores = indiceP >= perdedores.length;
    const soPerdedores = indiceV >= vencedores.length;
    const escolheVencedores = soPerdedores ? false : soVencedores ? true : proximo !== "PERDEDORES";
    if (escolheVencedores) {
      alternada.push(vencedores[indiceV++]!);
      proximo = "PERDEDORES";
    } else {
      alternada.push(perdedores[indiceP++]!);
      proximo = "VENCEDORES";
    }
  }

  const resultado: T[] = [];
  let indiceAlternada = 0;
  let indiceOutro = 0;
  while (indiceAlternada < alternada.length || indiceOutro < outros.length) {
    if (indiceOutro >= outros.length) {
      resultado.push(alternada[indiceAlternada++]!);
      continue;
    }
    if (indiceAlternada >= alternada.length) {
      resultado.push(outros[indiceOutro++]!);
      continue;
    }
    if (compararEspera(outros[indiceOutro]!, alternada[indiceAlternada]!) < 0) {
      resultado.push(outros[indiceOutro++]!);
    } else {
      resultado.push(alternada[indiceAlternada++]!);
    }
  }
  return resultado;
}

function ladoDoCodigo(lados: Map<string, LadoDaFila>, codigo: string): LadoDaFila {
  return lados.get(codigo) ?? "OUTRO";
}

export function montarItens(entradas: readonly EntradaDaFila[], lados = classificarLados(entradas.map((entrada) => ({
  id: entrada.codigo,
  chave: entrada.chave,
  origemA: entrada.origemA,
  origemB: entrada.origemB,
})))) {
  return entradas.map((entrada) => ({
    entrada,
    id: entrada.id,
    prontaEm: entrada.prontaEm,
    rodada: entrada.rodada,
    ordem: ordemNaFolha(entrada.codigo, entrada.posicao),
    lado: ladoDoCodigo(lados, entrada.codigo),
  }));
}

export function ultimoLadoJogando(entradas: readonly EntradaDaFila[], lados: Map<string, LadoDaFila>): LadoDaFila | null {
  let melhor: { lado: LadoDaFila; quando: number } | null = null;
  for (const entrada of entradas) {
    const lado = ladoDoCodigo(lados, entrada.codigo);
    if (lado !== "VENCEDORES" && lado !== "PERDEDORES") continue;
    const quando = OCUPANDO.has(entrada.status)
      ? (entrada.inicioEm ?? entrada.prontaEm)
      : entrada.status === "CONCLUIDA" && entrada.fimEm != null
        ? entrada.fimEm
        : null;
    if (quando == null) continue;
    if (!melhor || quando >= melhor.quando) melhor = { lado, quando };
  }
  return melhor?.lado ?? null;
}

export function ordenarEntradas(entradas: readonly EntradaDaFila[]): EntradaDaFila[] {
  const lados = classificarLados(
    entradas.map((entrada) => ({
      id: entrada.codigo,
      chave: entrada.chave,
      origemA: entrada.origemA,
      origemB: entrada.origemB,
    })),
  );
  const itens = montarItens(entradas, lados);
  const prontas = itens.filter((item) => partidaEntraNaFila(item.entrada.status, item.entrada.equipeAId, item.entrada.equipeBId));
  const ocupando = itens
    .filter((item) => OCUPANDO.has(item.entrada.status))
    .map((item) => ({ lado: item.lado }));
  const inicio = escolherInicio(
    prontas.filter((item) => item.lado === "VENCEDORES"),
    prontas.filter((item) => item.lado === "PERDEDORES"),
    ocupando,
    ultimoLadoJogando(entradas, lados),
  );
  return ordenarFila(prontas, inicio).map((item) => item.entrada);
}

export function rotuloDoLado(lado: LadoDaFila): string | null {
  if (lado === "VENCEDORES") return "Lado dos vencedores";
  if (lado === "PERDEDORES") return "Lado dos perdedores";
  return null;
}
