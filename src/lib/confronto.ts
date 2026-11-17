export function textoDoLado(nome: string | null | undefined, status: string): string {
  if (nome) return nome;
  if (status === "BYE" || status === "VAZIA" || status === "NAO_NECESSARIA") return "Folga";
  return "Aguardando adversário";
}
