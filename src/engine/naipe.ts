export type Sexo = "FEMININO" | "MASCULINO";
export type Naipe = "FEMININO" | "MASCULINO" | "MISTO";

export function validarNaipe(
  naipe: Naipe,
  sexos: readonly Sexo[],
  exigirParticipanteFeminina: boolean,
): { ok: true } | { ok: false; erro: string } {
  if (naipe === "FEMININO" && sexos.some((sexo) => sexo !== "FEMININO")) {
    return { ok: false, erro: "Neste torneio feminino, todas as atletas precisam ser mulheres." };
  }
  if (naipe === "MASCULINO" && sexos.some((sexo) => sexo !== "MASCULINO")) {
    return { ok: false, erro: "Neste torneio masculino, todos os atletas precisam ser homens." };
  }
  if (naipe === "MISTO" && exigirParticipanteFeminina && !sexos.includes("FEMININO")) {
    return { ok: false, erro: "A equipe mista precisa de pelo menos uma atleta feminina." };
  }
  return { ok: true };
}
