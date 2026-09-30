export const SPORTS = [
  "Futebol",
  "Futsal",
  "Vôlei",
  "Basquete",
  "Tênis",
  "Beach tennis",
  "Handebol",
] as const;

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
    note: "Dupla com Bruno, jogo confirmado e desafio pendente para responder",
  },
  {
    name: "Bruno Lima",
    email: "bruno.lima@arena.local",
    note: "Dupla com Ana",
  },
  {
    name: "Elena Costa",
    email: "elena.costa@arena.local",
    note: "Dupla com Felipe; enviou o desafio pendente",
  },
  {
    name: "Felipe Rocha",
    email: "felipe.rocha@arena.local",
    note: "Dupla com Elena",
  },
  {
    name: "Carla Mendes",
    email: "carla.mendes@arena.local",
    note: "Dupla com Diego; jogo de vôlei confirmado",
  },
  {
    name: "Diego Alves",
    email: "diego.alves@arena.local",
    note: "Dupla com Carla",
  },
  {
    name: "Gabriela Nunes",
    email: "gabriela.nunes@arena.local",
    note: "Convite de dupla pendente do Henrique",
  },
  {
    name: "Henrique Dias",
    email: "henrique.dias@arena.local",
    note: "Convite enviado para a Gabriela",
  },
  {
    name: "Marina Teixeira",
    email: "marina.teixeira@arena.local",
    note: "Sem dupla",
  },
  {
    name: "Otávio Pires",
    email: "otavio.pires@arena.local",
    note: "Sem dupla",
  },
] as const;

export type Sport = (typeof SPORTS)[number];
export type Court = (typeof COURTS)[number];
