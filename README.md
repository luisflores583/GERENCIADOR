# Areia Viva

Sistema de gerenciamento de torneios de vôlei de areia: inscrições, equipes, dupla eliminação, quadras e painel ao vivo.

A interface está em português. Datas aparecem como DD/MM/AAAA e horários no formato de 24 horas, no fuso de Brasília (UTC−3).

## Subir com Docker

Requisito: Docker com Compose.

Na pasta do projeto, com a branch `cursor/gerenciador-torneios-cc41` atualizada:

```bash
git pull
docker compose down
docker compose up --build
```

Espere a linha `Areia Viva disponível em http://localhost:3000` e abra esse endereço. A primeira tela traz o título “O torneio anda sozinho. Você registra a vitória.”, com Arena da Orla e Trios da Manhã.

Se a porta 3000 já estiver ocupada por outro container, pare esse outro antes. O comando `docker compose ps` mostra o serviço `app` em execução.

O Compose sobe o PostgreSQL 16 e a aplicação. Na primeira partida ele aplica as migrações e carrega o seed de demonstração.

Acesso local de demonstração, exibido na tela de entrada enquanto `EXIBIR_ACESSO_DEMO=true`:

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@arena.local` | `arena-local-demo` |
| Atleta | `ana@arena.local` (e os demais atletas do seed) | `atleta-local-demo` |

O torneio **Arena da Orla** já nasce em andamento, com quatro duplas e a primeira rodada nas quadras, sem placar. O torneio **Trios da Manhã** fica com inscrições individuais pendentes.

Essas senhas servem só para a máquina local. Troque-as antes de publicar.

## Subir sem Docker

Requisito: Node.js 22 e PostgreSQL 16.

```bash
cp .env.example .env
```

Preencha `DATABASE_URL`, `SESSION_SECRET`, `SEED_ADMIN_PASSWORD` e `SEED_ATHLETE_PASSWORD`. O arquivo `.env` não entra no Git.

```bash
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

A aplicação fica em `http://localhost:3000`.

O seed é idempotente: se o administrador ou os torneios de demonstração já existem, ele não troca a senha nem refaz a chave.

## Testes

```bash
npm test
```

Esse comando cobre o motor de dupla eliminação, os 20 critérios de aceitação e a exportação CSV/PDF. O teste de banco fica de fora enquanto a variável `RODAR_INTEGRACAO` não estiver ligada.

Com o PostgreSQL no ar e as migrações aplicadas em um banco separado:

```bash
createdb voley_test
DATABASE_URL=postgresql://voley:voley_dev@localhost:5432/voley_test npx prisma migrate deploy
RODAR_INTEGRACAO=1 DATABASE_URL=postgresql://voley:voley_dev@localhost:5432/voley_test npm run test:db
```

Ajuste usuário e senha do banco para o seu ambiente. O critério 18 verifica no código o contrato de layout responsivo (alvos de toque, viewport e chave com rolagem). A tela ao vivo também foi conferida no navegador em largura de celular, cerca de 375 px.

## Publicar na sua máquina

Não há deploy em serviço externo neste projeto. Publique com o mesmo Compose, atrás de um proxy reverso com HTTPS.

Antes de abrir para outras pessoas:

1. Troque `SESSION_SECRET`, a senha do PostgreSQL e as senhas do seed.
2. Defina `COOKIE_SECURE=true`.
3. Defina `EXIBIR_ACESSO_DEMO=false`.
4. Depois da primeira subida, defina `SEED_ON_START=false` para o seed não rodar de novo a cada reinício.
5. Aponte o proxy para a porta 3000 e sirva o site só por HTTPS.

Cópia de segurança do banco:

```bash
docker compose exec db pg_dump -U voley voley > copia.sql
```

Restauração:

```bash
docker compose exec -T db psql -U voley voley < copia.sql
```

As fotos de perfil ficam em `public/uploads`. Inclua essa pasta no backup se ela estiver fora do volume `uploads`.

## O que o sistema faz

- Perfis de administrador e atleta, com sessão em cookie `httpOnly`.
- Torneios isolados entre si, em dupla, trio ou quarteto.
- Inscrição individual ou equipe já formada, com aprovação e rejeição.
- Sorteio auditável de equipes e da primeira rodada. Na hora dos confrontos, o administrador sorteia as equipes aleatoriamente ou monta um ranking numerado. Sobra de atleta não é descartada. Equipe incompleta só entra com autorização explícita do administrador e com a regra ligada no torneio.
- Dupla eliminação: chave de vencedores, chave de perdedores, folga quando o número de equipes não é potência de 2, final e final extra.
- Tabela de até 16 times: jogos 1 a 30 da folha, com campeão da série Ouro no jogo 30 e campeã da série Prata no jogo 29. A posição 1 do ranking é a cabeça 1. A chave automática continua disponível para os outros torneios, também com sorteio aleatório ou ranking.
- Quadras, fila, indisponibilidade temporária e troca manual com validação.
- O administrador registra só a vitória da equipe. A correção fica no histórico e a mesma confirmação não conta a vitória duas vezes. Em Resultados, o botão Iniciar torneio começa a chave quando ela ainda não está em andamento. Na inscrição feita pelo administrador, nome e sexo bastam; e-mail e telefone são opcionais. Quando o atleta monta a própria equipe, o telefone continua obrigatório.
- Painel público ao vivo, exportação do resumo em CSV e PDF.
