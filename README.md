# Gerenciador — agenda de fisioterapia no WhatsApp

Pacientes marcam, remarcam e cancelam sessões por um chatbot no WhatsApp. A agenda do Google é a fonte da verdade dos horários: o bot só oferece o que está livre e grava a sessão como evento.

A conversa usa a [WhatsApp Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api) oficial (Graph API). Não há biblioteca não oficial de WhatsApp.

## O que o paciente vê

1. Saudação e pedido do nome, se o número ainda não for conhecido.
2. Menu com botões: **Agendar**, **Remarcar**, **Cancelar**.
3. Horários livres dos próximos 7 dias em uma lista.
4. Confirmação com botões antes de gravar, remarcar ou cancelar.

Padrão da clínica, tudo configurável por variáveis de ambiente:

- segunda a sexta, 08:00–18:00, fuso `America/Sao_Paulo`
- sessões de 50 minutos, em sequência (08:00, 08:50, 09:40, …, 17:10)
- uma agenda, de um fisioterapeuta

Cancelar **apaga** o evento, para a vaga voltar a aparecer como livre.

## Requisitos

- Node.js 22 ou superior
- App da Meta com o produto WhatsApp
- Projeto no Google Cloud com a API Google Calendar ativada
- Um túnel HTTPS (ngrok ou similar) para o webhook, quando for testar no celular

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
| `GET /webhook` | Verificação do webhook da Meta |
| `POST /webhook` | Mensagens recebidas |
| `GET /api/calendar/availability` | Horários livres e blocos ocupados, sem enviar WhatsApp |

## WhatsApp Cloud API

1. Acesse [developers.facebook.com](https://developers.facebook.com/apps) e crie um app do tipo **Business**.
2. Adicione o produto **WhatsApp**.
3. Em **WhatsApp → API Setup** (Configuração da API), copie:
   - **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`
   - o token temporário → `WHATSAPP_ACCESS_TOKEN`  
     O token de teste expira em cerca de 24 horas. Para uso contínuo, gere um token de system user permanente no Business Manager.
4. Escolha uma string longa e aleatória para `WHATSAPP_VERIFY_TOKEN`. O mesmo valor entra na Meta e no `.env`.
5. Em **App settings → Basic**, copie o **App secret** para `WHATSAPP_APP_SECRET`. Com ele definido, o `POST /webhook` só aceita corpo assinado (`X-Hub-Signature-256`). Sem o segredo, o POST fica aberto — útil só em desenvolvimento local.
6. No celular da Meta (número de teste), cadastre o seu WhatsApp em **To** / lista de destinatários. Fora dessa lista, o número de teste não entrega mensagem.
7. Suba um túnel até a porta local:

   ```bash
   ngrok http 3000
   ```

8. Em **WhatsApp → Configuration**, configure o webhook:
   - **Callback URL:** `https://<subdominio>.ngrok-free.app/webhook`
   - **Verify token:** o mesmo `WHATSAPP_VERIFY_TOKEN`
   - Assine o campo **messages**
9. A Meta chama `GET /webhook` com `hub.mode`, `hub.verify_token` e `hub.challenge`. Se o token bater, o servidor devolve o challenge.
10. Envie "oi" do seu WhatsApp para o número de teste. O bot responde dentro da janela de 24 horas aberta por essa mensagem. Este projeto não envia modelo (template) de fora dessa janela — lembrete automático ficaria para uma etapa seguinte, com template aprovado pela Meta.

`WHATSAPP_API_VERSION` padrão é `v25.0`. Se a Meta aposentar a versão, troque só essa variável.

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

Se definir `INTERNAL_CHECK_TOKEN`, a rota exige `Authorization: Bearer <token>`. Sem esse token, quem alcançar a porta vê os horários. Não coloque segredo nenhum na resposta além do ID da agenda.

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

Os testes cobrem a grade de horários, o fluxo da conversa, o webhook (verificação, assinatura e deduplicação) e a criação do evento. Não chamam a Meta nem o Google.

## Limitações

- Sem token da Meta, sem ID do número e sem agenda compartilhada, o processo sobe, mas nenhuma reserva real acontece.
- O número de teste da Meta só fala com destinatários autorizados no app.
- O bot só responde a quem escreveu nas últimas 24 horas. Não manda lembrete sozinho.
- A lista do WhatsApp tem no máximo 10 linhas; havendo mais horários, a conversa pagina.
- Dois cliques no mesmo horário quase ao mesmo tempo: o segundo recebe "esse horário acabou de ser preenchido".
- Cancelar remove o evento. Não fica um registro "cancelado" na agenda.
