import { Area, Campo, Entrada, Selecao } from "@/components/campo";

export function CamposTorneio({
  valores,
}: {
  valores?: {
    nome?: string;
    descricao?: string;
    regulamento?: string;
    inicioEm?: string;
    local?: string;
    formato?: string;
    formacao?: string;
    naipe?: string;
    modeloChave?: string;
    maxAtletas?: number | null;
    inscricoesAte?: string;
    valorReais?: string;
    pontosParaVencer?: number;
    diferencaMinima?: number;
    pontosMaximos?: number | null;
    quadrasSimultaneas?: number;
    descansoMinutos?: number;
    permitirEquipeIncompleta?: boolean;
    corDestaque?: string;
    nomeOrganizador?: string;
    travado?: boolean;
  };
}) {
  const v = valores ?? {};
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Campo id="nome" rotulo="Nome do torneio">
        <Entrada id="nome" name="nome" required defaultValue={v.nome} />
      </Campo>
      <Campo id="nomeOrganizador" rotulo="Organizador ou arena">
        <Entrada id="nomeOrganizador" name="nomeOrganizador" defaultValue={v.nomeOrganizador} />
      </Campo>
      <Campo id="local" rotulo="Local">
        <Entrada id="local" name="local" required defaultValue={v.local} />
      </Campo>
      <Campo id="corDestaque" rotulo="Cor de destaque" dica="Identidade visual deste torneio.">
        <Entrada id="corDestaque" name="corDestaque" type="color" defaultValue={v.corDestaque ?? "#e36a3a"} className="h-14 p-2" />
      </Campo>
      <Campo id="inicioEm" rotulo="Data e horário" dica="DD/MM/AAAA, horário de 24 horas.">
        <Entrada id="inicioEm" name="inicioEm" type="datetime-local" required defaultValue={v.inicioEm} />
      </Campo>
      <Campo id="inscricoesAte" rotulo="Prazo de inscrição" dica="DD/MM/AAAA, horário de 24 horas.">
        <Entrada id="inscricoesAte" name="inscricoesAte" type="datetime-local" required defaultValue={v.inscricoesAte} />
      </Campo>
      <Campo id="formato" rotulo="Formato das equipes">
        <Selecao id="formato" name="formato" defaultValue={v.formato ?? "DUPLA"} disabled={v.travado}>
          <option value="DUPLA">Duplas — 2 atletas</option>
          <option value="TRIO">Trios — 3 atletas</option>
          <option value="QUARTETO">Quartetos — 4 atletas</option>
        </Selecao>
        {v.travado ? <input type="hidden" name="formato" value={v.formato} /> : null}
      </Campo>
      <Campo id="formacao" rotulo="Formação das equipes">
        <Selecao id="formacao" name="formacao" defaultValue={v.formacao ?? "PRE_FORMADAS"} disabled={v.travado}>
          <option value="PRE_FORMADAS">Previamente formadas</option>
          <option value="SORTEADAS">Sorteadas após as inscrições</option>
        </Selecao>
        {v.travado ? <input type="hidden" name="formacao" value={v.formacao} /> : null}
      </Campo>
      <Campo id="naipe" rotulo="Naipe" dica="No misto, cada equipe precisa de pelo menos uma atleta feminina.">
        <Selecao id="naipe" name="naipe" defaultValue={v.naipe ?? "MISTO"} disabled={v.travado}>
          <option value="FEMININO">Feminino</option>
          <option value="MASCULINO">Masculino</option>
          <option value="MISTO">Misto</option>
        </Selecao>
        {v.travado ? <input type="hidden" name="naipe" value={v.naipe} /> : null}
      </Campo>
      <Campo id="modeloChave" rotulo="Tabela" dica="A tabela de até 16 times usa os jogos 1 a 30. A de até 32 times usa os jogos 1 a 62 do arquivo, sem o jogo 41. A chave automática vale para os outros torneios.">
        <Selecao id="modeloChave" name="modeloChave" defaultValue={v.modeloChave ?? "FOLHA_16"} disabled={v.travado}>
          <option value="FOLHA_16">Tabela de até 16 times</option>
          <option value="FOLHA_32">Tabela de até 32 times</option>
          <option value="GENERICA">Chave automática</option>
        </Selecao>
        {v.travado ? <input type="hidden" name="modeloChave" value={v.modeloChave ?? "GENERICA"} /> : null}
      </Campo>
      <Campo id="maxAtletas" rotulo="Limite de atletas" dica="Deixe vazio para não limitar.">
        <Entrada id="maxAtletas" name="maxAtletas" inputMode="numeric" defaultValue={v.maxAtletas ?? ""} />
      </Campo>
      <Campo id="valorReais" rotulo="Valor da inscrição" dica="Opcional. Exemplo: 50,00">
        <Entrada id="valorReais" name="valorReais" defaultValue={v.valorReais ?? ""} placeholder="50,00" />
      </Campo>
      <Campo id="pontosParaVencer" rotulo="Pontos para vencer">
        <Entrada id="pontosParaVencer" name="pontosParaVencer" inputMode="numeric" required defaultValue={v.pontosParaVencer ?? 21} />
      </Campo>
      <Campo id="diferencaMinima" rotulo="Diferença mínima">
        <Entrada id="diferencaMinima" name="diferencaMinima" inputMode="numeric" required defaultValue={v.diferencaMinima ?? 2} />
      </Campo>
      <Campo id="pontosMaximos" rotulo="Limite de pontos" dica="Vazio significa sem teto.">
        <Entrada id="pontosMaximos" name="pontosMaximos" inputMode="numeric" defaultValue={v.pontosMaximos ?? ""} />
      </Campo>
      <Campo id="quadrasSimultaneas" rotulo="Quadras simultâneas">
        <Entrada id="quadrasSimultaneas" name="quadrasSimultaneas" inputMode="numeric" required defaultValue={v.quadrasSimultaneas ?? 2} />
      </Campo>
      <Campo id="descansoMinutos" rotulo="Descanso mínimo (minutos)">
        <Entrada id="descansoMinutos" name="descansoMinutos" inputMode="numeric" defaultValue={v.descansoMinutos ?? 0} />
      </Campo>
      <div className="md:col-span-2">
        <Campo id="descricao" rotulo="Descrição">
          <Area id="descricao" name="descricao" defaultValue={v.descricao} />
        </Campo>
      </div>
      <div className="md:col-span-2">
        <Campo id="regulamento" rotulo="Regulamento">
          <Area id="regulamento" name="regulamento" defaultValue={v.regulamento} />
        </Campo>
      </div>
      <label className="flex min-h-14 items-center gap-3 text-base md:col-span-2">
        <input type="checkbox" name="permitirEquipeIncompleta" defaultChecked={v.permitirEquipeIncompleta} className="h-5 w-5" />
        Autorizar equipe incompleta no sorteio, somente com confirmação explícita
      </label>
    </div>
  );
}
