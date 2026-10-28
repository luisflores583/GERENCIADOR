import { Botao } from "@/components/botao";
import { Formulario } from "@/components/formulario";
import { acaoIniciarTorneio } from "@/server/acoes";

export function IniciarTorneio({ torneioId, retomada = false }: { torneioId: string; retomada?: boolean }) {
  return (
    <Formulario acao={acaoIniciarTorneio} className="w-auto">
      <input type="hidden" name="torneioId" value={torneioId} />
      <Botao type="submit">{retomada ? "Retomar torneio" : "Iniciar torneio"}</Botao>
    </Formulario>
  );
}
