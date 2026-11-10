const MODELOS_DE_CADASTRO = new Set(["Usuario", "Atleta", "Equipe", "Inscricao"]);

function alvos(target: unknown): string[] {
  if (Array.isArray(target)) return target.map((item) => String(item).toLowerCase());
  if (typeof target === "string") return [target.toLowerCase()];
  return [];
}

export function ehCadastroDuplicado(meta: unknown): boolean {
  if (!meta || typeof meta !== "object") return false;
  const registro = meta as { modelName?: unknown; target?: unknown };
  const modelo = typeof registro.modelName === "string" ? registro.modelName : "";
  if (MODELOS_DE_CADASTRO.has(modelo)) return true;
  if (modelo) return false;
  const alvo = alvos(registro.target);
  if (alvo.includes("email") || alvo.includes("usuarioid") || alvo.includes("atletaid")) return true;
  return alvo.includes("torneioid") && alvo.includes("nome");
}
