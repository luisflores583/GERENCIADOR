import { Campo, Entrada, Selecao } from "@/components/campo";

export function CamposEquipe({
  tamanho,
  fixo,
  permitirIncompleta = false,
}: {
  tamanho: number;
  fixo?: { id: string; nomeCompleto: string; sexo: "FEMININO" | "MASCULINO"; telefone: string | null };
  permitirIncompleta?: boolean;
}) {
  const indices = Array.from({ length: tamanho }, (_, indice) => indice);
  return (
    <div className="space-y-4">
      <Campo
        id="nomeEquipe"
        rotulo="Nome da equipe"
        dica="Opcional. Pode ser uma letra ou um número, como A ou 1. Em branco, a equipe fica com o nome dos atletas."
      >
        <Entrada id="nomeEquipe" name="nome" maxLength={80} autoComplete="off" />
      </Campo>
      {indices.map((indice) => {
        const proprio = indice === 0 && fixo;
        return (
          <fieldset key={indice} className="space-y-3 rounded-2xl bg-white p-4">
            <legend className="px-1 font-semibold text-navy">Integrante {indice + 1}{proprio ? " · você" : ""}</legend>
            {proprio ? (
              <>
                <input type="hidden" name={`integranteAtletaId${indice}`} value={fixo.id} />
                <input type="hidden" name={`integranteNome${indice}`} value={fixo.nomeCompleto} />
                <input type="hidden" name={`integranteSexo${indice}`} value={fixo.sexo} />
                <input type="hidden" name={`integranteTelefone${indice}`} value={fixo.telefone ?? ""} />
                <p className="text-lg font-bold">{fixo.nomeCompleto}</p>
              </>
            ) : (
              <>
                <Campo id={`integranteNome${indice}`} rotulo="Nome">
                  <Entrada id={`integranteNome${indice}`} name={`integranteNome${indice}`} autoComplete="off" required={!permitirIncompleta} />
                </Campo>
                <Campo id={`integranteSexo${indice}`} rotulo="Sexo">
                  <Selecao id={`integranteSexo${indice}`} name={`integranteSexo${indice}`} defaultValue="FEMININO">
                    <option value="FEMININO">Feminino</option>
                    <option value="MASCULINO">Masculino</option>
                  </Selecao>
                </Campo>
                <Campo id={`integranteTelefone${indice}`} rotulo="Telefone">
                  <Entrada id={`integranteTelefone${indice}`} name={`integranteTelefone${indice}`} autoComplete="tel" required={!permitirIncompleta} />
                </Campo>
                <Campo id={`integranteEmail${indice}`} rotulo="E-mail" dica="Opcional.">
                  <Entrada id={`integranteEmail${indice}`} name={`integranteEmail${indice}`} type="email" autoComplete="off" />
                </Campo>
              </>
            )}
          </fieldset>
        );
      })}
      {permitirIncompleta ? (
        <label className="flex min-h-14 items-center gap-3 text-base">
          <input type="checkbox" name="autorizarIncompleta" className="h-5 w-5" />
          Autorizo gravar esta equipe incompleta
        </label>
      ) : null}
    </div>
  );
}
