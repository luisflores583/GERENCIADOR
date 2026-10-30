const routed = $('Roteador da conversa').first().json;
const staticData = $getWorkflowStaticData('global');
if (!staticData.sessions) staticData.sessions = {};
if (!staticData.profiles) staticData.profiles = {};

const payloads = $input.all().map((item) => item.json);
const busy = extractBusy(payloads);
for (let i = 0; i < payloads.length; i += 1) {
  const payload = payloads[i];
  if (payload && payload.available === false && !payload.busy && !payload.calendars) {
    busy.push({ start: routed.timeMin, end: routed.timeMax });
  }
}

const result = applyFreeBusy({
  config: routed.config,
  session: routed.session,
  profile: routed.profile,
  phone: routed.phone,
  busy: busy,
  nowIso: new Date().toISOString(),
  purpose: routed.purpose,
  ignoreInterval: routed.ignoreInterval || null,
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
