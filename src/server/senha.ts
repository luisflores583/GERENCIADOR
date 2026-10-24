import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function gerarHash(senha: string): Promise<string> {
  const sal = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(senha, sal, 64)) as Buffer;
  return `${sal}:${hash.toString("hex")}`;
}

export async function conferirSenha(senha: string, armazenada: string): Promise<boolean> {
  const [sal, hashHex] = armazenada.split(":");
  if (!sal || !hashHex) return false;
  const hash = (await scryptAsync(senha, sal, 64)) as Buffer;
  const esperado = Buffer.from(hashHex, "hex");
  if (esperado.length !== hash.length) return false;
  return timingSafeEqual(hash, esperado);
}
