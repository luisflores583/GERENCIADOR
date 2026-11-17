import { describe, expect, it } from "vitest";
import { validarNaipe } from "@/engine/naipe";
import { sortearEquipes } from "@/engine/sorteio";

describe("naipe da equipe", () => {
  it("aceita feminino e masculino só com o sexo correspondente", () => {
    expect(validarNaipe("FEMININO", ["FEMININO", "FEMININO"], true).ok).toBe(true);
    expect(validarNaipe("FEMININO", ["FEMININO", "MASCULINO"], true).ok).toBe(false);
    expect(validarNaipe("MASCULINO", ["MASCULINO"], true).ok).toBe(true);
    expect(validarNaipe("MASCULINO", ["FEMININO"], false).ok).toBe(false);
  });

  it("exige pelo menos uma atleta no misto quando a equipe fecha", () => {
    expect(validarNaipe("MISTO", ["MASCULINO"], false).ok).toBe(true);
    const fechada = validarNaipe("MISTO", ["MASCULINO", "MASCULINO"], true);
    expect(fechada.ok).toBe(false);
    if (fechada.ok) return;
    expect(fechada.erro).toContain("pelo menos uma atleta feminina");
    expect(validarNaipe("MISTO", ["MASCULINO", "FEMININO"], true).ok).toBe(true);
    expect(validarNaipe("MISTO", ["FEMININO", "FEMININO"], true).ok).toBe(true);
  });

  it("coloca uma mulher em cada equipe sorteada no misto", () => {
    const sexos = {
      a: "FEMININO",
      b: "MASCULINO",
      c: "FEMININO",
      d: "MASCULINO",
      e: "MASCULINO",
      f: "MASCULINO",
    } as const;
    const sorteio = sortearEquipes({
      atletaIds: ["a", "b", "c", "d", "e", "f"],
      formato: "TRIO",
      semente: 11,
      autorizarIncompleta: false,
      naipe: "MISTO",
      sexos,
    });
    expect(sorteio.ok).toBe(true);
    if (!sorteio.ok) return;
    expect(sorteio.equipes).toHaveLength(2);
    for (const equipe of sorteio.equipes) {
      expect(equipe.atletaIds.some((id) => sexos[id as keyof typeof sexos] === "FEMININO")).toBe(true);
    }

    const semMulher = sortearEquipes({
      atletaIds: ["b", "d", "e", "f"],
      formato: "DUPLA",
      semente: 3,
      autorizarIncompleta: false,
      naipe: "MISTO",
      sexos,
    });
    expect(semMulher.ok).toBe(false);
    if (semMulher.ok) return;
    expect(semMulher.mensagem.toLowerCase()).toContain("ninguém foi excluído");
  });
});
