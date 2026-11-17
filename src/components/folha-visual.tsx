import { textoDoLado } from "@/lib/confronto";

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
  colunas: "12rem 11.5rem 11.5rem 11.5rem 11.5rem 11.5rem 12.5rem 12rem",
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
  colunas: "12rem 11.5rem 11.5rem 11.5rem 11.5rem 11.5rem 11.5rem 11.5rem 11.5rem 12.5rem 12rem",
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
      className={`flex h-full min-h-0 flex-col justify-center rounded-md border-2 bg-white px-2 py-1 ${celula.abertura ? "border-coral" : "border-navy"}`}
      data-jogo={celula.codigo}
    >
      <p className="text-[11px] font-bold leading-tight text-ocean">
        {celula.codigo}
        {celula.rotulo ? <span className="ml-1 font-semibold text-navy/70">{celula.rotulo}</span> : null}
      </p>
      <p className="truncate text-xs font-semibold leading-tight text-navy">{ladoA}</p>
      <p className="truncate text-xs font-semibold leading-tight text-navy">{ladoB}</p>
    </article>
  );
}

export function FolhaVisual({ partidas, modelo }: { partidas: JogoDaFolha[]; modelo: "FOLHA_16" | "FOLHA_32" }) {
  const grade = gradeDaFolha(modelo);
  const porCodigo = new Map(partidas.map((partida) => [partida.codigo, partida]));
  return (
    <div className="overflow-x-auto pb-2" data-chave="folha">
      <div className="min-w-max">
        <div className="mb-1 grid items-end gap-x-2 text-xs font-bold uppercase tracking-wide" style={{ gridTemplateColumns: grade.colunas }}>
          {grade.titulos.map((titulo, indice) => (
            <p key={indice} className={titulo === "Vencedores" ? "text-center text-coral" : "text-center text-navy"}>
              {titulo ?? ""}
            </p>
          ))}
        </div>
        <div
          className="grid gap-x-2 gap-y-1"
          style={{
            gridTemplateColumns: grade.colunas,
            gridTemplateRows: `repeat(${grade.linhas}, 4.25rem)`,
          }}
        >
          {grade.celulas.map((celula) => (
            <div
              key={celula.codigo}
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
  );
}
