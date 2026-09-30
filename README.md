# Ache sua dupla

Aplicativo da arena para atletas se cadastrarem, formarem uma dupla e desafiarem outra dupla em um horário que caiba na disponibilidade de todo mundo.

Autenticação local, com e-mail e senha. Os dados ficam num SQLite, sem serviço externo.

## Como rodar

Requisitos: Node.js 20+.

```bash
npm install
cp .env.example .env
npm run db:setup
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

`npm run db:setup` cria o banco e carrega os dados de demonstração. Para repetir o cenário do zero, rode `npm run db:seed`.

## Contas de demonstração

Senha de todas: `dupla123`

| Nome | E-mail | O que você encontra |
| --- | --- | --- |
| Ana Souza | ana.souza@arena.local | Dupla com Bruno, jogo de vôlei confirmado na agenda e um desafio de futsal pendente para responder |
| Bruno Lima | bruno.lima@arena.local | Dupla com Ana |
| Elena Costa | elena.costa@arena.local | Dupla com Felipe; enviou o desafio pendente |
| Felipe Rocha | felipe.rocha@arena.local | Dupla com Elena |
| Carla Mendes | carla.mendes@arena.local | Dupla com Diego; jogo de vôlei confirmado |
| Diego Alves | diego.alves@arena.local | Dupla com Carla |
| Gabriela Nunes | gabriela.nunes@arena.local | Convite de dupla do Henrique, ainda sem resposta |
| Henrique Dias | henrique.dias@arena.local | Convite enviado para a Gabriela |
| Marina Teixeira | marina.teixeira@arena.local | Sem dupla |
| Otávio Pires | otavio.pires@arena.local | Sem dupla |

Entre como Ana para ver a dupla, o desafio pendente e a agenda. Entre como Gabriela para aceitar ou recusar um convite. Marina e Otávio estão livres para um convite novo.

## Fluxo

1. Cadastro ou entrada com e-mail e senha.
2. Perfil com nome, esportes e disponibilidade semanal.
3. Lista de atletas: convidar uma pessoa. Ela aceita ou recusa. Só existe uma dupla ativa por vez.
4. A dupla desafia outra: esporte em comum, quadra e um horário livre para as quatro pessoas.
5. A dupla desafiada aceita, recusa ou propõe outro horário.
6. O desafio aceito aparece na agenda.
