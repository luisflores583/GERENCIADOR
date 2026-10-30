const routed = $('Roteador da conversa').first().json;
const expanded = $('Preparar calendários').all();
const events = pairEvents($input.all(), expanded);
const staticData = $getWorkflowStaticData('global');
if (!staticData.sessions) staticData.sessions = {};
if (!staticData.profiles) staticData.profiles = {};

const result = applyEventList({
  config: routed.config,
  phone: routed.phone,
  profile: routed.profile,
  events: events,
  nowIso: new Date().toISOString(),
  purpose: routed.purpose,
});

const phone = result.phone || routed.phone;
if (result.profile && result.profile.patientName && phone) {
  staticData.profiles[phone] = { patientName: result.profile.patientName };
}
if (phone && result.session && result.session.step && result.session.step !== 'menu') {
  staticData.sessions[phone] = result.session;
} else if (phone) {
  delete staticData.sessions[phone];
}

return [{ json: result }];
