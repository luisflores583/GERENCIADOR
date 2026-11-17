import { describe, expect, it } from "vitest";
import { aplicarVitoria, criarEstadoInicial, type PartidaMotor } from "@/engine/dupla-eliminacao";
import { textoDoLado } from "@/lib/confronto";

function ids(quantidade: number): string[] {
  return Array.from({ length: quantidade }, (_, indice) => `e${indice + 1}`);
}

function nomesDe(quantidade: number): Map<string, string> {
  return new Map(ids(quantidade).map((id, indice) => [id, `Equipe ${indice + 1}`]));
}

function jogo(partidas: PartidaMotor[], id: string): PartidaMotor {
  const partida = partidas.find((item) => item.id === id);
  if (!partida) throw new Error(`Jogo ${id} ausente`);
  return partida;
}

function lados(partida: PartidaMotor, nomes: Map<string, string>) {
  return {
    a: textoDoLado(partida.equipeAId ? nomes.get(partida.equipeAId) : null, partida.status),
    b: textoDoLado(partida.equipeBId ? nomes.get(partida.equipeBId) : null, partida.status),
  };
}

describe("confrontos na tabela", () => {
  it("mostra os nomes no jogo seguinte da tabela de 16 e mantém a folga", () => {
    const nomes = nomesDe(16);
    let estado = criarEstadoInicial(ids(16), "FOLHA_16");
    estado = aplicarVitoria(estado, "1", "e1").estado;
    expect(lados(jogo(estado.partidas, "9"), nomes)).toEqual({
      a: "Equipe 1",
      b: "Aguardando adversário",
    });
    expect(lados(jogo(estado.partidas, "10"), nomes)).toEqual({
      a: "Equipe 16",
      b: "Aguardando adversário",
    });

    estado = aplicarVitoria(estado, "2", "e9").estado;
    expect(lados(jogo(estado.partidas, "9"), nomes)).toEqual({ a: "Equipe 1", b: "Equipe 9" });
    expect(lados(jogo(estado.partidas, "10"), nomes)).toEqual({ a: "Equipe 16", b: "Equipe 8" });
    expect(jogo(estado.partidas, "11").equipeAId).toBeNull();
    expect(jogo(estado.partidas, "11").equipeBId).toBeNull();

    const incompleta = criarEstadoInicial(ids(12), "FOLHA_16");
    const abertura = jogo(incompleta.partidas, "1");
    expect(lados(abertura, nomesDe(12))).toEqual({ a: "Equipe 1", b: "Folga" });
    expect(abertura.status).toBe("BYE");
  });

  it("mostra os nomes no jogo seguinte da tabela de 32 e mantém a folga", () => {
    const nomes = nomesDe(32);
    let estado = criarEstadoInicial(ids(32), "FOLHA_32");
    estado = aplicarVitoria(estado, "1", "e1").estado;
    expect(lados(jogo(estado.partidas, "18"), nomes)).toEqual({
      a: "Equipe 1",
      b: "Aguardando adversário",
    });
    expect(lados(jogo(estado.partidas, "17"), nomes)).toEqual({
      a: "Equipe 32",
      b: "Aguardando adversário",
    });
    expect(jogo(estado.partidas, "20").equipeAId).toBeNull();

    estado = aplicarVitoria(estado, "2", "e17").estado;
    expect(lados(jogo(estado.partidas, "18"), nomes)).toEqual({ a: "Equipe 1", b: "Equipe 17" });
    expect(lados(jogo(estado.partidas, "17"), nomes)).toEqual({ a: "Equipe 32", b: "Equipe 16" });

    const incompleta = criarEstadoInicial(ids(31), "FOLHA_32");
    expect(lados(jogo(incompleta.partidas, "1"), nomesDe(31))).toEqual({ a: "Equipe 1", b: "Folga" });
  });
});
