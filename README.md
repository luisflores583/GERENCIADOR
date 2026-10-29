# Gerenciador — agenda de fisioterapia no WhatsApp

Pacientes marcam, remarcam e cancelam sessões por um chatbot no WhatsApp. A agenda do Google é a fonte da verdade dos horários: o bot só oferece o que está livre e grava a sessão como evento.

O WhatsApp entra pela [Evolution API v2](https://doc.evolution-api.com/v2) ([documentação em português](https://docs.evolutionfoundation.com.br)). O caminho padrão é uma instância **Baileys** já criada, conectada por QR code. Não é preciso criar um app na Meta.

## O que o paciente vê

1. Saudação e pedido do nome, se o número ainda não for conhecido.
2. Menu: **Agendar**, **Remarcar**, **Cancelar**.
3. Horários livres dos próximos 7 dias.
4. Confirmação antes de gravar, remarcar ou cancelar.

Quando a instância aceita mensagem interativa, o bot envia lista (`sendList`) e botões (`sendButtons`). No Baileys isso costuma falhar: aí a mesma opção segue como menu numerado, e o paciente responde `1`, `2`, `3`.

Padrão da clínica, tudo configurável por variáveis de ambiente:

- segunda a sexta, 08:00–18:00, fuso `America/Sao_Paulo`
- sessões de 50 minutos, em sequência (08:00, 08:50, 09:40, …, 17:10)
- uma agenda, de um fisioterapeuta

Cancelar **apaga** o evento, para a vaga voltar a aparecer como livre.

## Requisitos

- Node.js 22 ou superior
- Evolution API v2 no ar, com uma instância Baileys já conectada
- Projeto no Google Cloud com a API Google Calendar ativada
- Um túnel HTTPS (ngrok ou similar) se a Evolution não alcançar esta máquina direto

## Configuração rápida

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

O servidor sobe em `http://localhost:3000`.

| Rota | Uso |
| --- | --- |
| `GET /health` | Saúde do processo |
| `POST /webhook` | Evento `MESSAGES_UPSERT` da Evolution |
| `GET /api/calendar/availability` | Horários livres e blocos ocupados, sem enviar WhatsApp |

No `.env`:

```bash
EVOLUTION_API_URL=http://localhost:8080
EVOLUTION_INSTANCE=clinica
EVOLUTION_API_KEY=
```

`EVOLUTION_API_KEY` vai no header `apikey`. Não commite esse valor.

## Evolution API (Baileys)

Uma instância já criada basta. Este serviço não cria o app da Meta nem a instância.

1. Suba a Evolution API v2 e crie uma instância com integração **Baileys**.
2. Conecte o WhatsApp da clínica pelo QR code (`GET /instance/connect/{instancia}` ou o manager).
3. Copie o nome da instância e a apikey global (ou a da instância) para o `.env`.
4. Exponha este serviço. Na mesma rede Docker, use o nome do container. Fora dela:

   ```bash
   ngrok http 3000
   ```

5. Aponte o webhook da instância para `https://<tunel>/webhook` e assine só `MESSAGES_UPSERT`. Deixe o base64 desligado. Pelo manager, ou:

   ```bash
   curl -X POST "$EVOLUTION_API_URL/webhook/set/$EVOLUTION_INSTANCE" \
     -H "apikey: $EVOLUTION_API_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "webhook": {
         "enabled": true,
         "url": "https://SEU-TUNEL/webhook",
         "webhookByEvents": false,
         "webhookBase64": false,
         "events": ["MESSAGES_UPSERT"]
       }
     }'
   ```

6. Envie "oi" do WhatsApp para o número conectado.

O envio usa `POST /message/sendText/{instancia}`, `POST /message/sendList/{instancia}` e `POST /message/sendButtons/{instancia}`. Lista e botões que a instância recusar viram texto numerado.

## Google Calendar — conta de serviço (caminho padrão)

É o modo que o código usa quando `GOOGLE_SERVICE_ACCOUNT_JSON` está definido. A conta de serviço não tem "agenda principal" útil: compartilhe a agenda da clínica com o e-mail dela. Não use `primary`.

1. No [Google Cloud Console](https://console.cloud.google.com/), crie ou escolha um projeto.
2. Ative a **Google Calendar API**.
3. Em **IAM e administrador → Contas de serviço**, crie uma conta. Não precisa de delegação em todo o domínio.
4. Na conta, **Chaves → Adicionar chave → JSON**. Salve o arquivo fora do git, por exemplo `secrets/service-account.json`. A pasta `secrets/` já está no `.gitignore`.
5. Abra o JSON e copie o `client_email` (algo como `agenda@projeto.iam.gserviceaccount.com`).
6. No Google Calendar, abra a agenda da clínica → **Configurações da agenda → Compartilhar com pessoas específicas**.
7. Adicione o `client_email` com a permissão **Fazer alterações nos eventos**.
8. Em **Integrar agenda**, copie o **ID da agenda** (não é o e-mail da conta de serviço).
9. No `.env`:

   ```bash
   GOOGLE_SERVICE_ACCOUNT_JSON=./secrets/service-account.json
   GOOGLE_CALENDAR_ID=seu-id-da-agenda@group.calendar.google.com
   ```

O evento criado fica só na agenda da clínica. O paciente não recebe convite por e-mail: a confirmação vai pelo WhatsApp. O título é `Fisioterapia — Nome`, e a descrição traz o nome e o telefone.

## Google Calendar — OAuth (alternativa)

Use este caminho se a clínica não puder compartilhar a agenda com uma conta de serviço. Ele vale quando `GOOGLE_SERVICE_ACCOUNT_JSON` está **vazio**. Se os dois estiverem preenchidos, a conta de serviço ganha.

1. No mesmo projeto, configure a tela de consentimento OAuth.
2. Crie um **ID do cliente OAuth** (app para computador ou Web).
3. O escopo necessário é `https://www.googleapis.com/auth/calendar`.
4. Gere um refresh token. No [OAuth Playground](https://developers.google.com/oauthplayground/):
   - ícone de engrenagem → **Use your own OAuth credentials**
   - cole client id e client secret
   - escopo Calendar API v3 `https://www.googleapis.com/auth/calendar`
   - autorize com a conta dona da agenda e troque o código pelo refresh token
5. No `.env`:

   ```bash
   GOOGLE_CLIENT_ID=
   GOOGLE_CLIENT_SECRET=
   GOOGLE_REFRESH_TOKEN=
   GOOGLE_CALENDAR_ID=primary
   ```

   Com OAuth, `primary` é a agenda da pessoa que autorizou. Com conta de serviço, `primary` é a agenda vazia do robô — não use.

## Conferir a agenda sem WhatsApp

Com o `.env` da agenda preenchido:

```bash
npm run check-calendar
```

O comando lista os blocos ocupados e os horários livres dos próximos dias. Sai com código 1 se a agenda não estiver configurada ou se o Google recusar o acesso (arquivo ausente, ID errado ou agenda não compartilhada). Não envia mensagem.

A mesma consulta por HTTP:

```bash
curl http://localhost:3000/api/calendar/availability
```

Se definir `INTERNAL_CHECK_TOKEN`, a rota exige `Authorization: Bearer <token>`. Sem esse token, quem alcançar a porta vê os horários.

## Rodar em produção local

```bash
npm run build
npm start
```

O estado da conversa (nome e passo do fluxo) fica em SQLite, no caminho `DATA_PATH` (padrão `./data/clinic.sqlite`). A pasta `data/` não entra no git. As sessões marcadas continuam na agenda mesmo se o arquivo for apagado; o nome do paciente, não.

## Variáveis

Veja `.env.example`. As que mudam o expediente:

| Variável | Padrão | Efeito |
| --- | --- | --- |
| `EVOLUTION_API_URL` | — | Base da Evolution API v2 |
| `EVOLUTION_INSTANCE` | — | Nome da instância Baileys |
| `EVOLUTION_API_KEY` | — | Header `apikey` |
| `CLINIC_NAME` | Consultório de Fisioterapia | Nome nas mensagens |
| `CLINIC_TIMEZONE` | America/Sao_Paulo | Fuso dos horários |
| `CLINIC_OPEN` / `CLINIC_CLOSE` | 08:00 / 18:00 | Expediente `HH:mm` |
| `CLINIC_SESSION_MINUTES` | 50 | Duração de cada sessão |
| `CLINIC_DAYS_AHEAD` | 7 | Janela a partir de hoje |
| `CLINIC_WEEKDAYS` | 1,2,3,4,5 | 1 = segunda … 7 = domingo |
| `CLINIC_MIN_NOTICE_MINUTES` | 0 | Antecedência mínima |

## Testes

```bash
npm test
npm run typecheck
```

Os testes cobrem a grade de horários, o fluxo da conversa, o webhook da Evolution e a criação do evento. Não chamam a Evolution nem o Google.

## Limitações

- Sem `EVOLUTION_API_URL`, instância, apikey e agenda compartilhada, o processo sobe, mas nenhuma reserva real acontece.
- Lista e botões dependem da instância. No Baileys o fallback é o menu numerado.
- A lista interativa tem no máximo 10 linhas; havendo mais horários, a conversa pagina.
- Dois cliques no mesmo horário quase ao mesmo tempo: o segundo recebe "esse horário acabou de ser preenchido".
- Cancelar remove o evento. Não fica um registro "cancelado" na agenda.
