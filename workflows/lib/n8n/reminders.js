const config = $('Configuração do consultório').first().json.config;
const expanded = $('Preparar lembretes').all();
const events = pairEvents($input.all(), expanded);
const staticData = $getWorkflowStaticData('global');
if (!staticData.sent) staticData.sent = {};
const result = selectReminders({
  config: config,
  events: events,
  nowIso: new Date().toISOString(),
  sent: staticData.sent,
});
staticData.sent = result.sent;
if (!result.messages.length) return [];
return result.messages.map((message) => ({ json: { whatsappBody: message.whatsappBody } }));
