export type Papel = "ADMIN" | "ATLETA";

export const ACOES = {
  "torneio.criar": ["ADMIN"],
  "torneio.editar": ["ADMIN"],
  "torneio.iniciar": ["ADMIN"],
  "torneio.pausar": ["ADMIN"],
  "torneio.finalizar": ["ADMIN"],
  "inscricao.gerir": ["ADMIN"],
  "equipe.gerir": ["ADMIN"],
  "sorteio.confirmar": ["ADMIN"],
  "resultado.confirmar": ["ADMIN"],
  "resultado.corrigir": ["ADMIN"],
  "quadra.gerir": ["ADMIN"],
  "relatorio.exportar": ["ADMIN"],
  "inscricao.criar": ["ATLETA"],
  "perfil.editar": ["ATLETA"],
  "chave.ver": ["ADMIN", "ATLETA"],
  "painel.ver": ["ADMIN", "ATLETA"],
} as const;

export type Acao = keyof typeof ACOES;

export function pode(papel: Papel, acao: Acao): boolean {
  return (ACOES[acao] as readonly Papel[]).includes(papel);
}

export function afirmarMesmoTorneio(torneioDoRecurso: string, torneioInformado: string): void {
  if (torneioDoRecurso !== torneioInformado) {
    throw new Error("Recurso não pertence a este torneio.");
  }
}
