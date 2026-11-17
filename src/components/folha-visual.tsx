"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { construirFolha16 } from "@/engine/folha-16";
import { construirFolha32 } from "@/engine/folha-32";
import { textoDoLado } from "@/lib/confronto";

export type LigacaoDaFolha = {
  de: string;
  para: string;
  lado: "A" | "B";
  tipo: "VENCEDOR" | "PERDEDOR";
};

export function ligacoesDaFolha(modelo: "FOLHA_16" | "FOLHA_32"): LigacaoDaFolha[] {
  const partidas = modelo === "FOLHA_32" ? construirFolha32() : construirFolha16();
  const ligacoes: LigacaoDaFolha[] = [];
  for (const partida of partidas) {
    const lados = [
      ["A", partida.origemA],
      ["B", partida.origemB],
    ] as const;
    for (const [lado, origem] of lados) {
      if (origem.tipo === "VENCEDOR" || origem.tipo === "PERDEDOR") {
        ligacoes.push({ de: origem.partidaId, para: partida.id, lado, tipo: origem.tipo });
      }
    }
  }
  return ligacoes;
}

export type JogoDaFolha = {
  id: string;
  codigo: string;
  status: string;
  equipeA?: { nome: string } | null;
  equipeB?: { nome: string } | null;
};

export type CelulaDaFolha = {
  codigo: string;
  coluna: number;
  linha: number;
  span: number;
  rotulo?: string;
  abertura?: boolean;
};

export type GradeDaFolha = {
  colunas: string;
  linhas: number;
  celulas: CelulaDaFolha[];
  titulos: Array<string | null>;
};

function abertura(quantidade: number, coluna: number): CelulaDaFolha[] {
  return Array.from({ length: quantidade }, (_, indice) => ({
    codigo: String(indice + 1),
    coluna,
    linha: indice + 1,
    span: 1,
    abertura: true,
  }));
}

function pares(codigos: string[], coluna: number, span: number): CelulaDaFolha[] {
  return codigos.map((codigo, indice) => ({
    codigo,
    coluna,
    linha: indice * span + 1,
    span,
  }));
}

const GRADE_16: GradeDaFolha = {
  colunas: "9.25rem 8.5rem 8.5rem 8.5rem 8.5rem 8.5rem 9.5rem 9.25rem",
  linhas: 8,
  titulos: [null, null, null, "Perdedores", null, "Vencedores", null, null],
  celulas: [
    { codigo: "25", coluna: 1, linha: 1, span: 4, rotulo: "Semifinalista C" },
    { codigo: "26", coluna: 1, linha: 5, span: 4, rotulo: "Semifinalista D" },
    { codigo: "22", coluna: 2, linha: 1, span: 4 },
    { codigo: "24", coluna: 2, linha: 5, span: 4 },
    ...pares(["17", "18", "19", "20"], 3, 2),
    ...pares(["10", "12", "14", "16"], 4, 2),
    ...abertura(8, 5),
    ...pares(["9", "11", "13", "15"], 6, 2),
    { codigo: "21", coluna: 7, linha: 1, span: 4, rotulo: "Semifinalista A" },
    { codigo: "23", coluna: 7, linha: 5, span: 4, rotulo: "Semifinalista B" },
    { codigo: "27", coluna: 8, linha: 1, span: 2, rotulo: "B x C" },
    { codigo: "28", coluna: 8, linha: 3, span: 2, rotulo: "A x D" },
    { codigo: "29", coluna: 8, linha: 5, span: 2, rotulo: "Série Prata" },
    { codigo: "30", coluna: 8, linha: 7, span: 2, rotulo: "Série Ouro" },
  ],
};

const GRADE_32: GradeDaFolha = {
  colunas: "9.25rem 8.5rem 8.5rem 8.5rem 8.5rem 8.5rem 8.5rem 8.5rem 8.5rem 9.5rem 9.25rem",
  linhas: 16,
  titulos: [null, null, null, null, null, "Perdedores", null, "Vencedores", null, null, null],
  celulas: [
    { codigo: "57", coluna: 1, linha: 1, span: 8, rotulo: "Semifinalista C" },
    { codigo: "58", coluna: 1, linha: 9, span: 8, rotulo: "Semifinalista D" },
    ...pares(["55", "56"], 2, 8),
    ...pares(["51", "52", "53", "54"], 3, 4),
    ...pares(["47", "48", "49", "50"], 4, 4),
    ...pares(["33", "35", "37", "39", "41", "43", "45", "46"], 5, 2),
    ...pares(["17", "19", "21", "23", "25", "27", "29", "31"], 6, 2),
    ...abertura(16, 7),
    ...pares(["18", "20", "22", "24", "26", "28", "30", "32"], 8, 2),
    ...pares(["34", "36", "38", "40"], 9, 4),
    { codigo: "42", coluna: 10, linha: 1, span: 8, rotulo: "Semifinalista A" },
    { codigo: "44", coluna: 10, linha: 9, span: 8, rotulo: "Semifinalista B" },
    { codigo: "59", coluna: 11, linha: 1, span: 4, rotulo: "Semifinais" },
    { codigo: "60", coluna: 11, linha: 5, span: 4, rotulo: "Semifinais" },
    { codigo: "61", coluna: 11, linha: 9, span: 4, rotulo: "Finais" },
    { codigo: "62", coluna: 11, linha: 13, span: 4, rotulo: "Finais" },
  ],
};

export function gradeDaFolha(modelo: "FOLHA_16" | "FOLHA_32"): GradeDaFolha {
  return modelo === "FOLHA_32" ? GRADE_32 : GRADE_16;
}

function Caixa({ celula, partida }: { celula: CelulaDaFolha; partida?: JogoDaFolha }) {
  const status = partida?.status ?? "VAZIA";
  const ladoA = textoDoLado(partida?.equipeA?.nome, status);
  const ladoB = textoDoLado(partida?.equipeB?.nome, status);
  return (
    <article
      className={`w-full rounded-md border bg-white px-1.5 py-1 shadow-sm ${celula.abertura ? "border-coral" : "border-navy/30"}`}
      data-jogo={celula.codigo}
    >
      <p className="truncate text-[10px] font-bold leading-none text-ocean">
        {celula.codigo}
        {celula.rotulo ? <span className="ml-1 font-semibold text-navy/60">{celula.rotulo}</span> : null}
      </p>
      <p className="mt-0.5 truncate text-[11px] font-semibold leading-tight text-navy">{ladoA}</p>
      <p className="truncate text-[11px] font-semibold leading-tight text-navy/80">{ladoB}</p>
    </article>
  );
}

type CaixaMedida = { left: number; right: number; top: number; bottom: number; width: number; height: number };
type Traco = { id: string; d: string; cor: string };

type ItemDoTraco = {
  id: string;
  cor: string;
  origem: CaixaMedida;
  destino: CaixaMedida;
  colunaOrigem: number;
  colunaDestino: number;
  lado: "A" | "B";
  tipo: "VENCEDOR" | "PERDEDOR";
  yOrigem: number;
  yDestino: number;
  xOrigem: number;
  xDestino: number;
  salto: number;
  indoParaDireita: boolean;
  xSaida: number;
  xChegada: number;
  yCanal: number;
};

function corDoTraco(indoParaDireita: boolean, mesmaColuna: boolean, tipo: "VENCEDOR" | "PERDEDOR") {
  return indoParaDireita || (mesmaColuna && tipo === "VENCEDOR") ? "#e36a3a" : "#0e2a47";
}

function itensDosTracos(
  modelo: "FOLHA_16" | "FOLHA_32",
  caixas: Map<string, CaixaMedida>,
  colunaDe: Map<string, number>,
): ItemDoTraco[] {
  return ligacoesDaFolha(modelo).flatMap((ligacao) => {
    const origem = caixas.get(ligacao.de);
    const destino = caixas.get(ligacao.para);
    const colunaOrigem = colunaDe.get(ligacao.de);
    const colunaDestino = colunaDe.get(ligacao.para);
    if (!origem || !destino || colunaOrigem == null || colunaDestino == null) return [];
    const indoParaDireita = colunaDestino > colunaOrigem;
    const mesmaColuna = colunaDestino === colunaOrigem;
    const salto = Math.abs(colunaDestino - colunaOrigem);
    const yOrigem = origem.top + origem.height * (salto === 1 ? 0.5 : ligacao.tipo === "VENCEDOR" ? 0.18 : 0.84);
    const yDestino = destino.top + destino.height * (ligacao.lado === "A" ? 0.32 : 0.7);
    const xOrigem = indoParaDireita || mesmaColuna ? origem.right : origem.left;
    const xDestino = indoParaDireita ? destino.left : destino.right;
    return [{
      id: `${ligacao.tipo}-${ligacao.de}-${ligacao.para}-${ligacao.lado}`,
      cor: corDoTraco(indoParaDireita, mesmaColuna, ligacao.tipo),
      origem,
      destino,
      colunaOrigem,
      colunaDestino,
      lado: ligacao.lado,
      tipo: ligacao.tipo,
      yOrigem,
      yDestino,
      xOrigem,
      xDestino,
      salto,
      indoParaDireita,
      xSaida: xOrigem,
      xChegada: xDestino,
      yCanal: yOrigem,
    }];
  });
}

function bordasDasColunas(itens: ItemDoTraco[]) {
  const esquerda = new Map<number, number>();
  const direita = new Map<number, number>();
  for (const item of itens) {
    for (const [coluna, caixa] of [[item.colunaOrigem, item.origem], [item.colunaDestino, item.destino]] as const) {
      esquerda.set(coluna, Math.min(esquerda.get(coluna) ?? caixa.left, caixa.left));
      direita.set(coluna, Math.max(direita.get(coluna) ?? caixa.right, caixa.right));
    }
  }
  return { esquerda, direita };
}

function separarTrilhosLongos(itens: ItemDoTraco[], altura: number) {
  const longos = itens.filter((item) => item.salto > 1);
  const menorTop = Math.min(...itens.map((item) => Math.min(item.origem.top, item.destino.top)));
  const maiorBase = Math.max(...itens.map((item) => Math.max(item.origem.bottom, item.destino.bottom)));
  const topo: ItemDoTraco[] = [];
  const base: ItemDoTraco[] = [];
  const flexiveis: ItemDoTraco[] = [];
  for (const item of longos) {
    const meio = (item.yOrigem + item.yDestino) / 2;
    const relativo = (meio - menorTop) / Math.max(maiorBase - menorTop, 1);
    if (relativo < 0.38) topo.push(item);
    else if (relativo > 0.62) base.push(item);
    else flexiveis.push(item);
  }
  flexiveis.sort((um, outro) => um.yOrigem + um.yDestino - (outro.yOrigem + outro.yDestino));
  for (const item of flexiveis) {
    const prefereTopo = item.yOrigem + item.yDestino <= menorTop + maiorBase;
    if ((prefereTopo && topo.length <= base.length) || (!prefereTopo && topo.length < base.length)) topo.push(item);
    else base.push(item);
  }
  const limite = Math.ceil(longos.length / 2);
  while (topo.length > limite) {
    topo.sort((um, outro) => outro.yOrigem + outro.yDestino - (um.yOrigem + um.yDestino));
    const movido = topo.shift();
    if (movido) base.push(movido);
  }
  while (base.length > limite) {
    base.sort((um, outro) => um.yOrigem + um.yDestino - (outro.yOrigem + outro.yDestino));
    const movido = base.shift();
    if (movido) topo.push(movido);
  }
  topo.sort((um, outro) => um.yOrigem - outro.yOrigem || um.yDestino - outro.yDestino || um.id.localeCompare(outro.id));
  base.sort((um, outro) => outro.yOrigem - um.yOrigem || outro.yDestino - um.yDestino || um.id.localeCompare(outro.id));
  const passo = 22;
  topo.forEach((item, indice) => {
    item.yCanal = menorTop - 18 - (indice + 1) * passo;
  });
  base.forEach((item, indice) => {
    item.yCanal = maiorBase + 18 + (indice + 1) * passo;
  });
  return altura;
}

function faixaEntre(colunaMenor: number, colunaMaior: number) {
  return `${colunaMenor}|${colunaMaior}`;
}

function afastarLongos(itens: ItemDoTraco[]) {
  const ocupados = new Map<string, number[]>();
  const marcar = (chave: string, y: number) => {
    const lista = ocupados.get(chave) ?? [];
    lista.push(y);
    ocupados.set(chave, lista);
  };
  for (const item of itens) {
    if (item.salto === 1) {
      const menor = Math.min(item.colunaOrigem, item.colunaDestino);
      const chave = faixaEntre(menor, menor + 1);
      marcar(chave, item.yOrigem);
      marcar(chave, item.yDestino);
    }
    if (item.salto > 1) {
      const menor = Math.min(item.colunaOrigem, item.colunaDestino);
      const maior = Math.max(item.colunaOrigem, item.colunaDestino);
      for (let coluna = menor; coluna < maior; coluna += 1) marcar(faixaEntre(coluna, coluna + 1), item.yCanal);
    }
  }
  const escolher = (chave: string, caixa: CaixaMedida) => {
    const usados = ocupados.get(chave) ?? [];
    const meio = caixa.top + caixa.height / 2;
    const livre = (y: number) => usados.every((usado) => Math.abs(usado - y) >= 20);
    for (let distancia = 0; distancia <= 180; distancia += 4) {
      if (livre(meio - distancia)) {
        marcar(chave, meio - distancia);
        return meio - distancia;
      }
      if (distancia > 0 && livre(meio + distancia)) {
        marcar(chave, meio + distancia);
        return meio + distancia;
      }
    }
    marcar(chave, meio);
    return meio;
  };
  for (const item of itens) {
    if (item.salto <= 1) continue;
    const saida = item.indoParaDireita
      ? faixaEntre(item.colunaOrigem, item.colunaOrigem + 1)
      : faixaEntre(item.colunaOrigem - 1, item.colunaOrigem);
    const chegada = item.indoParaDireita
      ? faixaEntre(item.colunaDestino - 1, item.colunaDestino)
      : faixaEntre(item.colunaDestino, item.colunaDestino + 1);
    item.yOrigem = escolher(saida, item.origem);
    item.yDestino = escolher(chegada, item.destino);
  }
}

function separarVerticais(itens: ItemDoTraco[]) {
  const bordas = bordasDasColunas(itens);
  const pedidos = new Map<string, Array<{ ini: number; fim: number; aplicar: (x: number) => void }>>();
  const registrar = (colunaA: number, colunaB: number, y1: number, y2: number, aplicar: (x: number) => void) => {
    const lista = pedidos.get(`${colunaA}|${colunaB}`) ?? [];
    lista.push({ ini: Math.min(y1, y2), fim: Math.max(y1, y2), aplicar });
    pedidos.set(`${colunaA}|${colunaB}`, lista);
  };
  for (const item of itens) {
    if (item.salto === 0) continue;
    const menor = Math.min(item.colunaOrigem, item.colunaDestino);
    const maior = Math.max(item.colunaOrigem, item.colunaDestino);
    if (item.salto === 1) {
      registrar(menor, maior, item.yOrigem, item.yDestino, (x) => {
        item.xSaida = x;
      });
      continue;
    }
    if (item.indoParaDireita) {
      registrar(item.colunaOrigem, item.colunaOrigem + 1, item.yOrigem, item.yCanal, (x) => {
        item.xSaida = x;
      });
      registrar(item.colunaDestino - 1, item.colunaDestino, item.yCanal, item.yDestino, (x) => {
        item.xChegada = x;
      });
    } else {
      registrar(item.colunaOrigem - 1, item.colunaOrigem, item.yOrigem, item.yCanal, (x) => {
        item.xSaida = x;
      });
      registrar(item.colunaDestino, item.colunaDestino + 1, item.yCanal, item.yDestino, (x) => {
        item.xChegada = x;
      });
    }
  }
  for (const [chave, lista] of pedidos) {
    const [colunaA, colunaB] = chave.split("|").map(Number);
    const bordaA = bordas.direita.get(colunaA);
    const bordaB = bordas.esquerda.get(colunaB);
    if (bordaA == null || bordaB == null) continue;
    const ordenados = [...lista].sort((um, outro) => um.ini - outro.ini || um.fim - outro.fim);
    const fimDaFaixa: number[] = [];
    const faixaDe = new Map<(typeof ordenados)[number], number>();
    for (const intervalo of ordenados) {
      let faixa = fimDaFaixa.findIndex((fim) => intervalo.ini - fim >= 12);
      if (faixa < 0) {
        faixa = fimDaFaixa.length;
        fimDaFaixa.push(intervalo.fim);
      } else fimDaFaixa[faixa] = intervalo.fim;
      faixaDe.set(intervalo, faixa);
    }
    const largura = Math.abs(bordaB - bordaA);
    const quantidade = fimDaFaixa.length;
    const passo = quantidade <= 1 ? 0 : Math.min(20, (largura - 20) / (quantidade - 1));
    const origemX = Math.min(bordaA, bordaB) + 10;
    for (const intervalo of ordenados) intervalo.aplicar(origemX + (faixaDe.get(intervalo) ?? 0) * passo);
  }
}

function separarMesmaColuna(itens: ItemDoTraco[]) {
  const mesmos = itens.filter((item) => item.salto === 0);
  const grupos = new Map<number, ItemDoTraco[]>();
  for (const item of mesmos) {
    const lista = grupos.get(item.colunaOrigem) ?? [];
    lista.push(item);
    grupos.set(item.colunaOrigem, lista);
  }
  for (const lista of grupos.values()) {
    const borda = Math.max(...lista.map((item) => Math.max(item.origem.right, item.destino.right)));
    lista.sort((um, outro) => um.yOrigem - outro.yOrigem || um.yDestino - outro.yDestino || um.id.localeCompare(outro.id));
    lista.forEach((item, indice) => {
      item.xSaida = borda + 20 + indice * 22;
      item.xChegada = item.xDestino;
    });
  }
}

export function tracadosDasLigacoes(
  modelo: "FOLHA_16" | "FOLHA_32",
  caixas: Map<string, CaixaMedida>,
  altura: number,
): Traco[] {
  const colunaDe = new Map(gradeDaFolha(modelo).celulas.map((celula) => [celula.codigo, celula.coluna]));
  const itens = itensDosTracos(modelo, caixas, colunaDe);
  if (itens.length === 0) return [];
  separarTrilhosLongos(itens, altura);
  afastarLongos(itens);
  separarVerticais(itens);
  separarMesmaColuna(itens);
  return itens.map((item) => {
    if (item.salto === 1) {
      return { id: item.id, cor: item.cor, d: `M ${item.xOrigem} ${item.yOrigem} H ${item.xSaida} V ${item.yDestino} H ${item.xDestino}` };
    }
    if (item.salto === 0) {
      return { id: item.id, cor: item.cor, d: `M ${item.xOrigem} ${item.yOrigem} H ${item.xSaida} V ${item.yDestino} H ${item.xDestino}` };
    }
    const yLadoOrigem = item.origem.top + item.origem.height * (item.tipo === "VENCEDOR" ? 0.38 : 0.62);
    const yLadoDestino = item.destino.top + item.destino.height * (item.lado === "A" ? 0.32 : 0.7);
    const saida = Math.abs(yLadoOrigem - item.yOrigem) < 1 ? `M ${item.xOrigem} ${item.yOrigem}` : `M ${item.xOrigem} ${yLadoOrigem} V ${item.yOrigem}`;
    const chegada = Math.abs(yLadoDestino - item.yDestino) < 1 ? `H ${item.xDestino}` : `H ${item.xDestino} V ${yLadoDestino}`;
    return { id: item.id, cor: item.cor, d: `${saida} H ${item.xSaida} V ${item.yCanal} H ${item.xChegada} V ${item.yDestino} ${chegada}` };
  });
}

export function FolhaVisual({ partidas, modelo }: { partidas: JogoDaFolha[]; modelo: "FOLHA_16" | "FOLHA_32" }) {
  const grade = gradeDaFolha(modelo);
  const porCodigo = new Map(partidas.map((partida) => [partida.codigo, partida]));
  const area = useRef<HTMLDivElement>(null);
  const [tracados, setTracados] = useState<Traco[]>([]);
  const assinatura = partidas.map((partida) => `${partida.codigo}:${partida.status}:${partida.equipeA?.nome ?? ""}:${partida.equipeB?.nome ?? ""}`).join("|");

  useLayoutEffect(() => {
    const medir = () => {
      const quadro = area.current;
      if (!quadro) return;
      const limite = quadro.getBoundingClientRect();
      const caixas = new Map<string, CaixaMedida>();
      quadro.querySelectorAll<HTMLElement>("[data-jogo]").forEach((elemento) => {
        const codigo = elemento.dataset.jogo;
        if (!codigo) return;
        const retangulo = elemento.getBoundingClientRect();
        caixas.set(codigo, {
          left: retangulo.left - limite.left,
          right: retangulo.right - limite.left,
          top: retangulo.top - limite.top,
          bottom: retangulo.bottom - limite.top,
          width: retangulo.width,
          height: retangulo.height,
        });
      });
      setTracados(tracadosDasLigacoes(modelo, caixas, limite.height));
    };

    medir();
    const observador = new ResizeObserver(medir);
    if (area.current) observador.observe(area.current);
    return () => observador.disconnect();
  }, [modelo, assinatura]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-foam/80 p-3" data-chave="folha">
      <div className="min-w-max">
        <div className="mb-2 grid items-end gap-x-[11rem] px-28 text-[11px] font-bold uppercase tracking-wide" style={{ gridTemplateColumns: grade.colunas }}>
          {grade.titulos.map((titulo, indice) => (
            <p key={indice} className={titulo === "Vencedores" ? "text-center text-coral" : "text-center text-navy"}>
              {titulo ?? ""}
            </p>
          ))}
        </div>
        <div className="relative px-28 py-[15rem]" ref={area}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" data-ligacoes={tracados.length} aria-hidden="true">
            {tracados.map((traco) => (
              <path key={`${traco.id}-base`} d={traco.d} stroke="#fbf7f1" strokeWidth="6" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {tracados.map((traco) => (
              <path key={traco.id} d={traco.d} stroke={traco.cor} strokeWidth="5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </svg>
          <div
            className="relative grid items-center gap-x-[11rem] gap-y-2"
            style={{
              gridTemplateColumns: grade.colunas,
              gridTemplateRows: `repeat(${grade.linhas}, 3rem)`,
            }}
          >
            {grade.celulas.map((celula) => (
              <div
                key={celula.codigo}
                className="flex h-full items-center"
                style={{
                  gridColumn: celula.coluna,
                  gridRow: `${celula.linha} / span ${celula.span}`,
                }}
              >
                <Caixa celula={celula} partida={porCodigo.get(celula.codigo)} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
