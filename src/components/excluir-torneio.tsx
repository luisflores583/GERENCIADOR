import { Botao } from "@/components/botao";
import { Formulario } from "@/components/formulario";
import { acaoExcluirTorneio } from "@/server/acoes";

export function ExcluirTorneio({ torneioId, nome }: { torneioId: string; nome: string }) {
  return (
    <Formulario acao={acaoExcluirTorneio} className="w-full">
      <input type="hidden" name="torneioId" value={torneioId} />
      <label className="flex items-start gap-3 text-sm text-navy">
        <input type="checkbox" name="confirmo" className="mt-1 h-5 w-5 shrink-0" />
        <span>
          Confirmo excluir {nome}. A exclusão não pode ser desfeita e apaga inscrições, equipes, sorteios, partidas e resultados deste torneio.
        </span>
      </label>
      <Botao type="submit" variante="perigo">Excluir torneio</Botao>
    </Formulario>
  );
}
