import { ErroDeRegra } from "@/lib/erros";
import { prisma } from "@/server/db";

export async function carregarUsuario(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    include: { atleta: true },
  });
  if (!usuario) throw new ErroDeRegra("Sessão inválida.", 401);
  return usuario;
}

export async function exigirAdministrador(usuarioId: string) {
  const usuario = await carregarUsuario(usuarioId);
  if (usuario.papel !== "ADMIN") throw new ErroDeRegra("Acesso restrito ao administrador.", 403, "PROIBIDO");
  return usuario;
}
