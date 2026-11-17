import { Botao } from "@/components/botao";
import { Formulario } from "@/components/formulario";
import { acaoEncerrarInscricao } from "@/server/acoes";

export function EncerrarInscricao({ torneioId }: { torneioId: string }) {
  return (
    <Formulario acao={acaoEncerrarInscricao} className="w-full">
      <input type="hidden" name="torneioId" value={torneioId} />
      <label className="flex items-start gap-3 text-sm text-navy">
        <input type="checkbox" name="confirmo" className="mt-1 h-5 w-5 shrink-0" />
        <span>Confirmo encerrar as inscrições. A lista atual permanece. Ninguém novo entra.</span>
      </label>
      <Botao type="submit" variante="secundario">Encerrar inscrição</Botao>
    </Formulario>
  );
}
