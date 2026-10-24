export const AVISO_EQUIPE_NA_CHAVE =
  "Esta equipe já está na chave. A inscrição não foi removida, para a tabela não mudar.";

export function equipesDoAtletaNaChave(equipesDoAtleta: readonly string[], equipesNaChave: ReadonlySet<string>) {
  return equipesDoAtleta.filter((equipeId) => equipesNaChave.has(equipeId));
}
