import { describe, expect, it } from "vitest";
import { desambiguarNome, nomeAutomatico, pareceNomeAutomatico, resolverNomeEquipe } from "@/engine/nomes";
import { sortearEquipes } from "@/engine/sorteio";

describe("nome da equipe", () => {
  it("aceita uma letra ou um número e deixa o nome em branco virar os atletas", () => {
    expect(resolverNomeEquipe("A", ["Ana Lima", "Bia Costa"])).toEqual({ ok: true, nome: "A", automatico: false });
    expect(resolverNomeEquipe("1", ["Ana Lima", "Bia Costa"])).toEqual({ ok: true, nome: "1", automatico: false });
    expect(resolverNomeEquipe("12", ["Ana Lima"])).toEqual({ ok: true, nome: "12", automatico: false });
    expect(resolverNomeEquipe("  ", ["Bia Costa", "Ana Lima"])).toEqual({
      ok: true,
      nome: "Ana Lima e Bia Costa",
      automatico: true,
    });
    expect(nomeAutomatico(["Caio Dias", "Ana Lima", "Bia Costa"])).toBe("Ana Lima, Bia Costa e Caio Dias");
    expect(nomeAutomatico(["Lia Torres"])).toBe("Lia Torres");
  });

  it("rejeita um nome sem letra ou número e evita repetir o mesmo nome no torneio", () => {
    const invalido = resolverNomeEquipe("---", ["Ana Lima"]);
    expect(invalido.ok).toBe(false);
    expect(desambiguarNome("Ana Lima e Bia Costa", ["Ana Lima e Bia Costa"])).toBe("Ana Lima e Bia Costa (2)");
    expect(desambiguarNome("Ana Lima e Bia Costa", ["Ana Lima e Bia Costa", "Ana Lima e Bia Costa (2)"])).toBe(
      "Ana Lima e Bia Costa (3)",
    );
    expect(pareceNomeAutomatico("Ana Lima e Bia Costa (2)", ["Bia Costa", "Ana Lima"])).toBe(true);
    expect(pareceNomeAutomatico("1", ["Ana Lima", "Bia Costa"])).toBe(false);
  });

  it("nomeia o sorteio com os atletas quando os nomes são conhecidos", () => {
    const semNome = sortearEquipes({
      atletaIds: ["a", "b"],
      formato: "DUPLA",
      semente: 42,
      autorizarIncompleta: false,
    });
    expect(semNome.ok && semNome.equipes[0]?.nome).toBe("Equipe 01");

    const nomes = { a: "Ana Lima", b: "Bia Costa", c: "Caio Dias", d: "Duda Nunes" };
    const comNome = sortearEquipes({
      atletaIds: ["a", "b", "c", "d"],
      formato: "DUPLA",
      semente: 42,
      autorizarIncompleta: false,
      nomes,
    });
    expect(comNome.ok).toBe(true);
    if (!comNome.ok) return;
    expect(comNome.equipes.map((equipe) => equipe.nome)).toEqual(
      comNome.equipes.map((equipe) => nomeAutomatico(equipe.atletaIds.map((id) => nomes[id as keyof typeof nomes]))),
    );
  });
});
