# Agenda de fisioterapia no WhatsApp

Dois workflows do n8n para o consultório. O paciente conversa no WhatsApp, escolhe um horário livre e a consulta só entra na Agenda do Google depois da confirmação.

Arquivos para importar:

- `workflows/fisioterapia-agenda-whatsapp.json` — chatbot
- `workflows/fisioterapia-lembretes-whatsapp.json` — aviso no WhatsApp cerca de 24 h e de 1 h antes

Não há token, senha nem ID real neste repositório. Os valores `SEU_PHONE_NUMBER_ID`, `TROQUE_ESTE_VERIFY_TOKEN` e `SEU_CALENDAR_ID@group.calendar.google.com` são placeholders.

## O que o fluxo faz

1. A Meta chama o webhook. No GET, o n8n devolve o challenge se o verify token bater. No POST, responde 200 na hora e segue a conversa.
2. Mensagens de status (entregue, lido) e reações são ignoradas. Mensagem repetida também.
3. O paciente vê um menu: **Agendar**, **Remarcar**, **Cancelar**, **Ver meus horários**. Dá para tocar na lista ou responder `1`, `2`, `3`, `4`. `0` ou `menu` volta ao início.
4. **Agendar:** tipo da sessão (avaliação ou retorno), nome completo, dia e horário livre. Com um fisioterapeuta, a escolha do profissional é pulada.
5. Os horários livres vêm do free/busy do Google Calendar. O que está ocupado não aparece. Almoço e fim do expediente também não.
6. O bot mostra o resumo e **só então** cria o evento, se o horário ainda estiver livre.
7. **Remarcar** e **cancelar** procuram eventos futuros cuja descrição tem o telefone (`ID_PACIENTE: tel:…`). Remarcar atualiza o mesmo evento. Cancelar apaga, depois de uma confirmação.
8. Resposta que não corresponde à etapa volta ao menu. Nome curto demais pede o nome de novo.
9. O outro workflow avisa o paciente no WhatsApp. O evento também leva lembrete popup na agenda da clínica (24 h e 1 h).

O evento fica **ocupado** na agenda (não transparente).

- Título: `Fisioterapia — Maria Silva (Avaliação)`
- Descrição: nome, telefone, tipo, profissional e a marca `ID_PACIENTE`
- Lembretes popup: 1440 e 60 minutos

## Suposições

- WhatsApp pela **Cloud API oficial** da Meta (webhook + envio). O node nativo do n8n não envia lista interativa, então o envio é um HTTP Request com a credencial WhatsApp API.
- Botões de resposta aceitam no máximo **3**. O menu tem 4 opções, então ele é uma **lista** (até 10 linhas). Confirmar, outro horário e menu usam botões. Em todo passo também vale responder o número.
- Começa com **um** fisioterapeuta e **um** calendário. Para outro, copie um item de `professionals`. A lista do WhatsApp mostra até 10 profissionais.
- Fuso `America/Sao_Paulo`.
- Avaliação 50 min e retorno 50 min. O passo entre horários é `slotMinutes` (50). Se a sessão for mais longa que o passo, o passo acompanha a duração para não sobrepor.
- Expediente padrão: segunda a sexta, 8h–18h, almoço 12h–13h. O último horário da manhã é 10:30 (termina 11:20). O da tarde termina 18:00.
- A conversa fica na memória do próprio workflow (`static data`), por telefone, por 2 horas. Serve para um consultório. Não é um banco separado.
- O lembrete do Google avisa a **conta da clínica**. O lembrete do paciente é o segundo workflow.
- O bot só acha consultas que ele mesmo gravou (a descrição traz o telefone). Evento criado à mão na agenda não entra em remarcar/cancelar, a menos que a descrição tenha a linha `ID_PACIENTE: tel:5511…`.
- Não há verificação `X-Hub-Signature-256`: o n8n entrega o JSON já interpretado, sem o corpo cru.

## Pré-requisitos

- n8n **1.70 ou mais novo** (Webhook 2, Code 2, IF 2.2, Switch 3.2, HTTP Request 4.2, Google Calendar 1.3, Schedule Trigger 1.2).
- n8n com URL pública HTTPS. A Meta não chama localhost.
- App da Meta com o produto WhatsApp e um número Cloud API.
- Conta Google com a API Google Calendar habilitada e um calendário da clínica.
- Fuso do n8n em `America/Sao_Paulo` (o workflow também pede esse fuso).

## Credenciais

Crie as duas no n8n **antes** de abrir os nodes. Na importação, o n8n pede para associar cada uma. Os IDs `PREENCHER_WHATSAPP` e `PREENCHER_GOOGLE_CALENDAR` não existem na sua instância: escolha a credencial certa.

### WhatsApp Cloud API

No n8n: credencial do tipo **WhatsApp API**, nome sugerido **WhatsApp Cloud API**.

Preencha com o que a Meta mostrar no seu app (não use valor de exemplo da internet):

- Access Token (de preferência um token de system user, de longa duração)
- Business Account ID (WABA)

O Phone Number ID **não** fica nesta credencial. Ele entra no node de configuração.

O node **Enviar WhatsApp** / **Enviar lembrete** já está assim:

- Authentication: Predefined Credential Type
- Credential type: WhatsApp API
- Credencial: WhatsApp Cloud API

### Google Calendar OAuth2

No n8n: credencial **Google Calendar OAuth2 API**, nome sugerido **Google Calendar**.

No Google Cloud: projeto, API Google Calendar ativada, tela de consentimento e cliente OAuth. No n8n, conecte a conta que pode **editar** o calendário da clínica. Se o calendário for de outra conta, compartilhe com permissão de alteração.

Os nodes do Google já apontam para a credencial **Google Calendar**.

## O que preencher

Abra o node **Configuração do consultório** nos **dois** workflows e edite o objeto `CONFIG`. Mantenha os dois iguais.

| Campo | Exemplo do que é | Onde achar |
| --- | --- | --- |
| `clinicName` | Nome que o paciente vê | Você escolhe |
| `whatsappPhoneNumberId` | ID do número, não o telefone em si | Meta → WhatsApp → API Setup → Phone number ID |
| `whatsappVerifyToken` | Uma frase que você inventa | A mesma frase no webhook da Meta |
| `professionals[0].name` | Nome do fisioterapeuta | Você escolhe |
| `professionals[0].calendarId` | ID do calendário | Google Calendar → configurações do calendário → Integrar calendário → ID do calendário |
| `location` | Endereço, ou deixe `""` | Você escolhe |
| `dayStart`, `dayEnd`, `lunchStart`, `lunchEnd` | `08:00`, `18:00`, `12:00`, `13:00` | Expediente |
| `businessDays` | `1` segunda … `5` sexta, `6` sábado, `7` domingo | Dias abertos |
| `slotMinutes` | `50` | Intervalo da grade |
| `sessionTypes` | Avaliação e retorno, 50 min cada | Duração de cada tipo |
| `reminderMinutes` | `[1440, 60]` | Popup na agenda e janelas do lembrete no WhatsApp |
| `minLeadMinutes` | `60` | Não oferece horário que começa em menos de 1 h |
| `timezone` | `America/Sao_Paulo` | Não troque sem revisar os horários |

Para um segundo fisioterapeuta, copie o objeto dentro de `professionals` e mude `id`, `name` e `calendarId`. Com mais de um, o bot pergunta com quem agendar.

## Como importar

1. No n8n: **Workflows → Import from file**.
2. Importe `workflows/fisioterapia-agenda-whatsapp.json`.
3. Importe `workflows/fisioterapia-lembretes-whatsapp.json`.
4. Em cada node do Google Calendar, selecione a credencial **Google Calendar**.
5. Nos nodes **Enviar WhatsApp** e **Enviar lembrete**, selecione **WhatsApp Cloud API**.
6. Edite **Configuração do consultório** nos dois.
7. Salve. Ative os dois. O webhook de produção só existe com o workflow da agenda **ativo**.

URL de produção (a mesma para verificação e mensagens):

```text
https://SEU-N8N/webhook/fisioterapia-whatsapp
```

Na Meta (WhatsApp → Configuration → Webhook):

- Callback URL: a URL acima
- Verify token: o mesmo `whatsappVerifyToken` do CONFIG
- Assine o campo **messages**

Os dois nodes de webhook usam o caminho `fisioterapia-whatsapp`, um em GET e outro em POST. É o que a Meta exige na mesma URL.

## Como testar

A lógica da conversa e da grade de horários está em `workflows/lib/agenda-logic.mjs` e não chama a Meta nem o Google:

```bash
node --test workflows/lib/agenda-logic.test.mjs workflows/lib/workflow-shape.test.mjs
```

Se editar essa lógica, gere de novo os JSON:

```bash
node workflows/lib/build-workflows.mjs
```

No n8n, com credenciais e CONFIG preenchidos:

1. Ative o workflow da agenda.
2. Do seu celular, mande `oi` para o número da clínica. Deve chegar o menu.
3. Siga agendar → tipo → nome e sobrenome → dia → horário → **Confirmar**.
4. O evento deve aparecer na agenda, com o nome no título e o telefone na descrição. O horário deixa de ser oferecido para outra pessoa.
5. `4` lista a consulta. `2` remarca. `3` cancela, só depois de confirmar.
6. Mande `xyz` no meio: a resposta diz que não entendeu e volta ao menu.
7. Ative o workflow de lembretes. Ele roda no minuto 0 de cada hora (`0 * * * *`). Para um teste, execute esse workflow à mão; ele só envia se a consulta cair na janela de ±70 minutos ao redor de 24 h ou de 1 h.

Enquanto `calendarId` ainda for o placeholder, o bot não chama o Google: avisa que a agenda não está configurada.

## Limites úteis

- Lista do WhatsApp: até 10 opções. Por isso a grade padrão tem 10 horários no dia (4 de manhã e 6 de tarde). Se a duração mudar e passar de 10 livres, o bot mostra “Mais horários”.
- Botão: título de até 20 caracteres. Lista: título de até 24.
- A sessão expira em `sessionTtlMinutes` (120). O nome do paciente continua associado ao telefone.
- Dois pacientes no mesmo horário: o free/busy é consultado de novo na confirmação. Se alguém levou o horário, o bot pede outro.
