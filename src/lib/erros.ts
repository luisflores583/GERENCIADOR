export class ErroDeRegra extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly detalhes?: unknown;

  constructor(mensagem: string, status = 400, codigo = "REGRA", detalhes?: unknown) {
    super(mensagem);
    this.name = "ErroDeRegra";
    this.status = status;
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

export function mensagemDeErro(erro: unknown): string {
  if (erro instanceof ErroDeRegra) return erro.message;
  if (erro instanceof Error && erro.message) return erro.message;
  return "Não foi possível concluir a operação.";
}
