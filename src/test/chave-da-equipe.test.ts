import { describe, expect, it } from "vitest";
import { AVISO_EQUIPE_NA_CHAVE, equipesDoAtletaNaChave } from "@/lib/chave-da-equipe";

describe("exclusão de inscrição com a chave gerada", () => {
  it("bloqueia quando a equipe do atleta já entrou em um jogo", () => {
    const bloqueadas = equipesDoAtletaNaChave(["equipe-a", "equipe-b"], new Set(["equipe-b"]));
    expect(bloqueadas).toEqual(["equipe-b"]);
    expect(AVISO_EQUIPE_NA_CHAVE).toMatch(/chave/);
  });

  it("libera quando a equipe ainda não entrou na chave", () => {
    expect(equipesDoAtletaNaChave(["equipe-a"], new Set(["outra"]))).toEqual([]);
    expect(equipesDoAtletaNaChave([], new Set(["equipe-a"]))).toEqual([]);
  });
});
