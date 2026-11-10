import { describe, expect, it } from "vitest";
import { ehCadastroDuplicado } from "@/lib/restricao-unica";

describe("mensagem de cadastro duplicado", () => {
  it("vale para atleta, equipe e inscrição", () => {
    expect(ehCadastroDuplicado({ modelName: "Usuario", target: ["email"] })).toBe(true);
    expect(ehCadastroDuplicado({ modelName: "Atleta", target: ["usuarioId"] })).toBe(true);
    expect(ehCadastroDuplicado({ modelName: "Equipe", target: ["torneioId", "nome"] })).toBe(true);
    expect(ehCadastroDuplicado({ modelName: "Inscricao", target: ["torneioId", "atletaId"] })).toBe(true);
  });

  it("não vale para quadra, partida ou sorteio", () => {
    expect(ehCadastroDuplicado({ modelName: "Partida", target: ["quadraId"] })).toBe(false);
    expect(ehCadastroDuplicado({ modelName: "Partida", target: ["torneioId", "codigo"] })).toBe(false);
    expect(ehCadastroDuplicado({ modelName: "Quadra", target: ["nome"] })).toBe(false);
    expect(ehCadastroDuplicado({ modelName: "Sorteio", target: ["id"] })).toBe(false);
    expect(ehCadastroDuplicado({ modelName: "TorneioQuadra", target: ["torneioId", "quadraId"] })).toBe(false);
  });

  it("reconhece o alvo quando o modelo não vem no erro", () => {
    expect(ehCadastroDuplicado({ target: ["email"] })).toBe(true);
    expect(ehCadastroDuplicado({ target: ["torneioId", "atletaId"] })).toBe(true);
    expect(ehCadastroDuplicado({ target: ["quadraId"] })).toBe(false);
  });
});
