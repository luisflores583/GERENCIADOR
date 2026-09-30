export const SPORTS = ["Vôlei", "Beach tennis", "Futevôlei"] as const;

export const FORMATS = [
  { id: "dupla", label: "Dupla", size: 2, hint: "2 atletas" },
  { id: "trio", label: "Trio", size: 3, hint: "3 atletas" },
  { id: "quarteto", label: "Quarteto", size: 4, hint: "4 atletas" },
] as const;

export type FormatId = (typeof FORMATS)[number]["id"];

export function formatById(kind: string) {
  return FORMATS.find((item) => item.id === kind) ?? FORMATS[0];
}

export function twoTeamsPhrase(kind: string) {
  if (kind === "trio") return "dos dois trios";
  if (kind === "quarteto") return "dos dois quartetos";
  return "das duas duplas";
}

export function otherTeamPhrase(kind: string) {
  if (kind === "trio") return "outro trio";
  if (kind === "quarteto") return "outro quarteto";
  return "outra dupla";
}

export function yourTeam(kind: string) {
  if (kind === "trio") return "Seu trio";
  if (kind === "quarteto") return "Seu quarteto";
  return "Sua dupla";
}

export const COURTS = [
  "Quadra 1",
  "Quadra 2",
  "Quadra Central",
  "Quadra de Areia",
  "Ginásio",
] as const;

export const WEEKDAYS = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda", short: "Seg" },
  { value: 2, label: "Terça", short: "Ter" },
  { value: 3, label: "Quarta", short: "Qua" },
  { value: 4, label: "Quinta", short: "Qui" },
  { value: 5, label: "Sexta", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
] as const;

export const DEMO_PASSWORD = "dupla123";

export const DEMO_ACCOUNTS = [
  {
    name: "Ana Souza",
    email: "ana.souza@arena.local",
    note: "Dupla com Bruno e jogo de vôlei confirmado na agenda",
  },
  {
    name: "Carla Mendes",
    email: "carla.mendes@arena.local",
    note: "Trio com Diego e Elena; desafio de beach tennis pendente para responder",
  },
  {
    name: "Felipe Rocha",
    email: "felipe.rocha@arena.local",
    note: "Trio com Gabriela e Henrique; enviou o desafio pendente",
  },
  {
    name: "Marina Teixeira",
    email: "marina.teixeira@arena.local",
    note: "Quarteto com Otávio, Sofia e Tiago",
  },
  {
    name: "Iara Costa",
    email: "iara.costa@arena.local",
    note: "Convite de dupla pendente do Lucas",
  },
  {
    name: "Camila Rocha",
    email: "camila.rocha@arena.local",
    note: "Sem equipe; pode formar dupla, trio ou quarteto",
  },
] as const;

export type Sport = (typeof SPORTS)[number];
export type Court = (typeof COURTS)[number];
