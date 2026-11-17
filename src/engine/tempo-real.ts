export interface EventoAoVivo {
  torneioId: string;
  tipo: string;
  em: string;
}

type Ouvinte = (evento: EventoAoVivo) => void;

const canais = new Map<string, Set<Ouvinte>>();

export function assinar(torneioId: string, ouvinte: Ouvinte): () => void {
  const conjunto = canais.get(torneioId) ?? new Set<Ouvinte>();
  conjunto.add(ouvinte);
  canais.set(torneioId, conjunto);
  return () => {
    conjunto.delete(ouvinte);
    if (conjunto.size === 0) canais.delete(torneioId);
  };
}

export function publicar(torneioId: string, tipo: string): EventoAoVivo {
  const evento: EventoAoVivo = { torneioId, tipo, em: new Date().toISOString() };
  for (const ouvinte of canais.get(torneioId) ?? []) ouvinte(evento);
  return evento;
}

export function ouvintesAtivos(torneioId: string): number {
  return canais.get(torneioId)?.size ?? 0;
}
