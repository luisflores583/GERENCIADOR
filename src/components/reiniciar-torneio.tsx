import { Botao } from "@/components/botao";
import { Formulario } from "@/components/formulario";
import { acaoReiniciarTorneio } from "@/server/acoes";

export function ReiniciarTorneio({ torneioId }: { torneioId: string }) {
  return (
    <Formulario acao={acaoReiniciarTorneio} className="w-full">
      <input type="hidden" name="torneioId" value={torneioId} />
      <label className="flex items-start gap-3 text-sm text-navy">
        <input type="checkbox" name="confirmo" className="mt-1 h-5 w-5 shrink-0" />
        <span>Confirmo reiniciar este torneio. Os jogos saem. Os atletas inscritos permanecem.</span>
      </label>
      <Botao type="submit" variante="secundario">Reiniciar torneio</Botao>
    </Formulario>
  );
}
