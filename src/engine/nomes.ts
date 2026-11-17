const LIMITE = 80;

export function nomeAutomatico(nomes: readonly string[]): string {
  const limpos = nomes
    .map((nome) => nome.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
  if (limpos.length === 0) return "Equipe";
  if (limpos.length === 1) return limpos[0]!.slice(0, LIMITE);
  const ultimo = limpos[limpos.length - 1]!;
  const inicio = limpos.slice(0, -1).join(", ");
  return `${inicio} e ${ultimo}`.slice(0, LIMITE);
}

export function resolverNomeEquipe(
  informado: string,
  nomesAtletas: readonly string[],
): { ok: true; nome: string; automatico: boolean } | { ok: false; erro: string } {
  const titulo = informado.trim();
  if (!titulo) {
    if (nomesAtletas.every((nome) => !nome.trim())) {
      return { ok: false, erro: "Informe os atletas da equipe." };
    }
    return { ok: true, nome: nomeAutomatico(nomesAtletas), automatico: true };
  }
  if (titulo.length > LIMITE) {
    return { ok: false, erro: "O nome da equipe pode ter no máximo 80 caracteres." };
  }
  if (!/[\p{L}\p{N}]/u.test(titulo)) {
    return { ok: false, erro: "Use letras ou números no nome da equipe. Se preferir, deixe em branco para usar os nomes dos atletas." };
  }
  return { ok: true, nome: titulo, automatico: false };
}

export function desambiguarNome(base: string, ocupados: Iterable<string>): string {
  const usados = new Set(ocupados);
  const candidato = (indice: number | null) => {
    if (indice == null) return base.slice(0, LIMITE);
    const sufixo = ` (${indice})`;
    return `${base.slice(0, Math.max(1, LIMITE - sufixo.length)).trimEnd()}${sufixo}`;
  };
  if (!usados.has(candidato(null))) return candidato(null);
  for (let indice = 2; indice < 1000; indice++) {
    const nome = candidato(indice);
    if (!usados.has(nome)) return nome;
  }
  return candidato(999);
}

export function pareceNomeAutomatico(atual: string, nomesAtletas: readonly string[]): boolean {
  const base = nomeAutomatico(nomesAtletas);
  if (atual === base) return true;
  const prefixo = `${base} (`;
  if (!atual.startsWith(prefixo) || !atual.endsWith(")")) return false;
  return /^\d+$/.test(atual.slice(prefixo.length, -1));
}
