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

function tracoDaLigacao(
  origem: CaixaMedida,
  destino: CaixaMedida,
  lado: "A" | "B",
  colunaOrigem: number,
  colunaDestino: number,
  tipo: "VENCEDOR" | "PERDEDOR",
  altura: number,
  ordem: number,
): { d: string; cor: string } {
  const yOrigem = origem.top + origem.height / 2;
  const yDestino = destino.top + (lado === "A" ? destino.height * 0.32 : destino.height * 0.68);
  const indoParaDireita = colunaDestino > colunaOrigem;
  const xOrigem = indoParaDireita || colunaDestino === colunaOrigem ? origem.right : origem.left;
  const xDestino = indoParaDireita ? destino.left : colunaDestino === colunaOrigem ? destino.right : destino.right;
  const cor = indoParaDireita || (colunaDestino === colunaOrigem && tipo === "VENCEDOR") ? "#e36a3a" : "#0e2a47";
  const salto = Math.abs(colunaDestino - colunaOrigem);

  if (salto === 0) {
    const xFora = Math.max(origem.right, destino.right) + 22;
    return { cor, d: `M ${xOrigem} ${yOrigem} H ${xFora} V ${yDestino} H ${destino.right}` };
  }

  if (salto === 1) {
    const xTrilho = (xOrigem + xDestino) / 2;
    return { cor, d: `M ${xOrigem} ${yOrigem} H ${xTrilho} V ${yDestino} H ${xDestino}` };
  }

  const meio = (origem.top + destino.top) / 2;
  const noTopo = meio < altura / 2;
  const deslocamento = (ordem % 14) * 8;
  const yCanal = noTopo ? 14 + deslocamento : altura - 14 - deslocamento;
  const xSaida = indoParaDireita ? origem.right + 6 : origem.left - 6;
  const xChegada = indoParaDireita ? destino.left - 6 : destino.right + 6;
  return {
    cor,
    d: `M ${xOrigem} ${yOrigem} H ${xSaida} V ${yCanal} H ${xChegada} V ${yDestino} H ${xDestino}`,
  };
}

export function FolhaVisual({ partidas, modelo }: { partidas: JogoDaFolha[]; modelo: "FOLHA_16" | "FOLHA_32" }) {
  const grade = gradeDaFolha(modelo);
  const porCodigo = new Map(partidas.map((partida) => [partida.codigo, partida]));
  const area = useRef<HTMLDivElement>(null);
  const [tracados, setTracados] = useState<Traco[]>([]);
  const assinatura = partidas.map((partida) => `${partida.codigo}:${partida.status}:${partida.equipeA?.nome ?? ""}:${partida.equipeB?.nome ?? ""}`).join("|");

  useLayoutEffect(() => {
    const colunaDe = new Map(gradeDaFolha(modelo).celulas.map((celula) => [celula.codigo, celula.coluna]));
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
      let sequencia = 0;
      const proximos = ligacoesDaFolha(modelo).flatMap((ligacao) => {
        const origem = caixas.get(ligacao.de);
        const destino = caixas.get(ligacao.para);
        const colunaOrigem = colunaDe.get(ligacao.de);
        const colunaDestino = colunaDe.get(ligacao.para);
        if (!origem || !destino || colunaOrigem == null || colunaDestino == null) return [];
        const ordem = Math.abs(colunaDestino - colunaOrigem) > 1 ? sequencia++ : 0;
        const traco = tracoDaLigacao(origem, destino, ligacao.lado, colunaOrigem, colunaDestino, ligacao.tipo, limite.height, ordem);
        return [{ id: `${ligacao.tipo}-${ligacao.de}-${ligacao.para}-${ligacao.lado}`, ...traco }];
      });
      setTracados(proximos);
    };

    medir();
    const observador = new ResizeObserver(medir);
    if (area.current) observador.observe(area.current);
    return () => observador.disconnect();
  }, [modelo, assinatura]);

  return (
    <div className="overflow-x-auto rounded-2xl border border-navy/10 bg-foam/80 p-3" data-chave="folha">
      <div className="min-w-max">
        <div className="mb-2 grid items-end gap-x-10 px-8 text-[11px] font-bold uppercase tracking-wide" style={{ gridTemplateColumns: grade.colunas }}>
          {grade.titulos.map((titulo, indice) => (
            <p key={indice} className={titulo === "Vencedores" ? "text-center text-coral" : "text-center text-navy"}>
              {titulo ?? ""}
            </p>
          ))}
        </div>
        <div className="relative px-8 py-32" ref={area}>
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" data-ligacoes={tracados.length} aria-hidden="true">
            {tracados.map((traco) => (
              <path key={`${traco.id}-base`} d={traco.d} stroke="#fbf7f1" strokeWidth="11" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ))}
            {tracados.map((traco) => (
              <path key={traco.id} d={traco.d} stroke={traco.cor} strokeWidth="5" fill="none" strokeLinejoin="round" strokeLinecap="round" />
            ))}
          </svg>
          <div
            className="relative grid items-center gap-x-10 gap-y-2"
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
