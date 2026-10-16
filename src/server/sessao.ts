import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";

const COOKIE = "sessao";
const DIAS = 14;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function criarSessao(usuarioId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiraEm = new Date(Date.now() + DIAS * 24 * 60 * 60 * 1000);
  await prisma.sessao.create({
    data: { usuarioId, tokenHash: hashToken(token), expiraEm },
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    expires: expiraEm,
  });
}

export async function encerrarSessao(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.sessao.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  jar.delete(COOKIE);
}

export async function obterUsuario() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const sessao = await prisma.sessao.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { usuario: { include: { atleta: true } } },
  });
  if (!sessao || sessao.expiraEm.getTime() < Date.now()) return null;
  return sessao.usuario;
}

export async function exigirUsuario() {
  const usuario = await obterUsuario();
  if (!usuario) redirect("/entrar");
  return usuario;
}

export async function exigirAdmin() {
  const usuario = await exigirUsuario();
  if (usuario.papel !== "ADMIN") redirect("/atleta");
  return usuario;
}

export async function exigirAtleta() {
  const usuario = await exigirUsuario();
  if (usuario.papel !== "ATLETA" || !usuario.atleta) redirect("/");
  return { usuario, atleta: usuario.atleta };
}
