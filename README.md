# Manicure — MVP

Sistema de agendamento e gestão para profissionais de manicure/pedicure, com painel admin (PWA) e bot WhatsApp de menu numérico.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind CSS
- Prisma ORM
- SQLite no desenvolvimento local (sem Docker). **PostgreSQL em produção** (troca documentada abaixo)
- Auth por cookie JWT (`jose` + `bcryptjs`)
- WhatsApp: provider abstrato + adapter **mock** + webhook

## Setup rápido

```bash
cp .env.example .env
npm install
npm run db:setup   # prisma db push + seed
npm run dev
```

Abra http://localhost:3000

**Login demo:** `demo@manicure.app` / `demo1234`

## PostgreSQL (produção)

1. Em `prisma/schema.prisma`, altere:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

2. Em `.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/manicure?schema=public"
```

3. Rode `npx prisma db push` (ou migrate) e `npm run db:seed`.

O schema já é multi-tenant (`organizationId` / `professionalId` em todas as entidades relevantes).

## Módulos do painel

Dashboard · Agenda · Clientes · Serviços · Horários · Bloqueios · Financeiro · Relatórios · WhatsApp · Configurações

Todos com CRUD/API reais e isolamento por organização.

## WhatsApp (mock)

- Webhook: `POST /api/whatsapp/webhook` com `{ "phone": "11999999999", "body": "0" }`
- Verificação estilo Meta: `GET /api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=...&hub.challenge=...`
- Envio: `POST /api/whatsapp/send` (autenticado)
- Simulador visual em **WhatsApp** no menu admin

Menu do bot:

1 Agendar · 2 Consultar · 3 Cancelar · 4 Serviços · 5 Falar com profissional · 6 Encerrar · `0` = menu

## Motor de disponibilidade

Slots consideram horário de funcionamento, almoço, feriados, bloqueios, duração do serviço e agendamentos ativos — sem double-booking. Cancelar libera o horário. Concluir/pagar gera receita no financeiro.

## PWA

- `public/manifest.webmanifest`
- Ícones em `public/icons/`
- Theme color blush; instalável via “Adicionar à tela inicial”

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção |
| `npm run db:push` | Sincroniza schema |
| `npm run db:seed` | Dados demo |
| `npm run db:setup` | push + seed |

## API (amostra)

- `POST /api/auth/login` · `POST /api/auth/logout`
- `GET/POST /api/clients` · `GET/PUT/DELETE /api/clients/:id`
- `GET/POST /api/services` · `PUT/DELETE /api/services/:id`
- `GET/POST /api/appointments` · `PUT/DELETE /api/appointments/:id`
- `GET /api/availability?serviceId=&date=`
- `GET/POST /api/financial`
- `GET /api/reports` · `?format=csv`
- `GET/POST /api/whatsapp/webhook` · `POST /api/whatsapp/send`
