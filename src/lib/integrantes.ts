export type IntegranteInformado = {
  atletaId: string;
  nome: string;
  sexo: "FEMININO" | "MASCULINO" | "";
  telefone: string;
  email: string;
};

export function integrantesDoFormulario(ler: (campo: string) => string, tamanho: number): IntegranteInformado[] {
  const linhas: IntegranteInformado[] = [];
  for (let indice = 0; indice < tamanho; indice++) {
    const atletaId = ler(`integranteAtletaId${indice}`).trim();
    const nome = ler(`integranteNome${indice}`).trim();
    const telefone = ler(`integranteTelefone${indice}`).trim();
    const email = ler(`integranteEmail${indice}`).trim();
    const sexoBruto = ler(`integranteSexo${indice}`).trim();
    if (!atletaId && !nome && !telefone && !email) continue;
    const sexo = sexoBruto === "FEMININO" || sexoBruto === "MASCULINO" ? sexoBruto : "";
    linhas.push({ atletaId, nome, sexo, telefone, email });
  }
  return linhas;
}
