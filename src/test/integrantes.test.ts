import { describe, expect, it } from "vitest";
import { integrantesDoFormulario } from "@/lib/integrantes";
import { validarElenco } from "@/engine/sorteio";

describe("integrantes da equipe", () => {
  it("lê um campo por integrante e ignora a linha em branco", () => {
    const campos: Record<string, string> = {
      integranteNome0: "Ana Lima",
      integranteSexo0: "FEMININO",
      integranteTelefone0: "21911112222",
      integranteNome1: "  ",
      integranteSexo1: "MASCULINO",
      integranteNome2: "Caio Nunes",
      integranteSexo2: "MASCULINO",
    };
    const linhas = integrantesDoFormulario((campo) => campos[campo] ?? "", 3);
    expect(linhas.map((linha) => linha.nome)).toEqual(["Ana Lima", "Caio Nunes"]);
    expect(validarElenco("TRIO", linhas.length, false).ok).toBe(false);
    expect(validarElenco("DUPLA", 2, false).ok).toBe(true);
    expect(validarElenco("DUPLA", 1, false).ok).toBe(false);
    expect(validarElenco("DUPLA", 1, true).ok).toBe(true);
  });
});
