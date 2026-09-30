# Ache sua dupla

Aplicativo da arena para atletas se cadastrarem, formarem uma dupla, um trio ou um quarteto e desafiarem outra equipe do mesmo formato. Os esportes são vôlei, beach tennis e futevôlei.

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

No Windows, entre na pasta do projeto antes desses comandos. No PowerShell, copie o ambiente com `copy .env.example .env`.

## Contas de demonstração

Senha de todas: `dupla123`

| Nome | E-mail | O que você encontra |
| --- | --- | --- |
| Ana Souza | ana.souza@arena.local | Dupla com Bruno e jogo de vôlei confirmado |
| Paula Ribeiro | paula.ribeiro@arena.local | Dupla com Ricardo, do outro lado do jogo confirmado |
| Carla Mendes | carla.mendes@arena.local | Trio com Diego e Elena; desafio de beach tennis para responder |
| Felipe Rocha | felipe.rocha@arena.local | Trio com Gabriela e Henrique; enviou o desafio pendente |
| Marina Teixeira | marina.teixeira@arena.local | Quarteto com Otávio, Sofia e Tiago |
| Iara Costa | iara.costa@arena.local | Convite de dupla do Lucas |
| Camila Rocha | camila.rocha@arena.local | Sem equipe; pode começar uma dupla, um trio ou um quarteto |

Bruno, Ricardo, Diego, Elena, Gabriela, Henrique, Otávio, Sofia, Tiago e Lucas também entram com a mesma senha.

## Fluxo

1. Cadastro ou entrada com e-mail e senha.
2. Perfil com nome, esportes (vôlei, beach tennis, futevôlei) e disponibilidade semanal.
3. Escolha dupla, trio ou quarteto e convide os atletas. Cada pessoa aceita ou recusa. Só existe uma equipe ativa por vez.
4. A equipe desafia outra do mesmo formato: esporte em comum, quadra e um horário livre para todo mundo.
5. A equipe desafiada aceita, recusa ou propõe outro horário.
6. O desafio aceito aparece na agenda.
