export type SituacaoVisual = "INVICTA" | "UMA_DERROTA" | "ELIMINADA" | "CAMPEA" | "VICE" | "CAMPEA_OURO" | "CAMPEA_PRATA";

export type LadoChaveDto =
  | "VENCEDORES"
  | "PERDEDORES"
  | "FINAL"
  | "FINAL_EXTRA"
  | "SEMIFINALISTA_A"
  | "SEMIFINALISTA_B"
  | "SEMIFINALISTA_C"
  | "SEMIFINALISTA_D"
  | "SEMIFINAL"
  | "SEM_REGIAO";

export type EquipeResumo = {
  id: string;
  nome: string;
  vitorias: number;
  derrotas: number;
  situacao: SituacaoVisual;
  membros: string[];
  cabeca: number | null;
};

export type PartidaResumo = {
  id: string;
  codigo: string;
  chave: LadoChaveDto;
  rodada: number;
  posicao: number;
  fase: string;
  equipeA: { id: string; nome: string; situacao: SituacaoVisual } | null;
  equipeB: { id: string; nome: string; situacao: SituacaoVisual } | null;
  placarA: number | null;
  placarB: number | null;
  status: string;
  quadra: string | null;
  quadraId: string | null;
  inicioEm: string | null;
  fimEm: string | null;
  aguardandoAdversario: boolean;
};

export type PainelDTO = {
  torneio: {
    id: string;
    nome: string;
    slug: string;
    descricao: string;
    regulamento: string;
    local: string;
    modalidade: string;
    formato: "DUPLA" | "TRIO" | "QUARTETO";
    formacao: "PRE_FORMADAS" | "SORTEADAS";
    naipe: "FEMININO" | "MASCULINO" | "MISTO";
    status: string;
    inicioEm: string;
    inscricoesAte: string;
    corDestaque: string;
    nomeOrganizador: string;
    pontosParaVencer: number;
    diferencaMinima: number;
    pontosMaximos: number | null;
    quadrasSimultaneas: number;
    valorCentavos: number | null;
    atletasConfirmados: number;
  };
  contagens: { equipes: number; emDisputa: number; eliminadas: number };
  equipes: EquipeResumo[];
  partidas: PartidaResumo[];
  quadras: Array<{
    id: string;
    nome: string;
    habilitada: boolean;
    indisponivel: boolean;
    indisponivelAte: string | null;
    partidaId: string | null;
  }>;
  fila: PartidaResumo[];
  classificacao: Array<EquipeResumo & { posicao: number }>;
  campeao: string | null;
  vice: string | null;
  modeloChave: "GENERICA" | "FOLHA_16";
  campeaoOuro: string | null;
  campeaoPrata: string | null;
  atualizadoEm: string;
};

export type EstadoAcao = {
  ok: boolean;
  erro?: string;
  mensagem?: string;
  precisaConfirmacao?: boolean;
  afetadas?: { codigo: string; descricao: string }[];
};

export const estadoInicial: EstadoAcao = { ok: true };
