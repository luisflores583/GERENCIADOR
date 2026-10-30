const routed = $('Roteador da conversa').first().json;
const prior = routed.action === 'delete_event' ? routed : $('Montar horários livres').first().json;
const staticData = $getWorkflowStaticData('global');
if (!staticData.sessions) staticData.sessions = {};
if (prior.phone) delete staticData.sessions[prior.phone];
return [{ json: { whatsappBody: prior.whatsappBody } }];
