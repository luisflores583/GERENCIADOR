const root = $input.first().json;
const staticData = $getWorkflowStaticData('global');
if (!staticData.sessions) staticData.sessions = {};
if (!staticData.profiles) staticData.profiles = {};
if (!staticData.seen) staticData.seen = [];

const incoming = parseIncoming(root.request);
if (!incoming) {
  return [{ json: { action: 'ignore' } }];
}

const noted = registerMessage(staticData.seen, incoming.messageId);
staticData.seen = noted.seen;
if (noted.duplicate || incoming.silent) {
  return [{ json: { action: 'ignore', duplicate: noted.duplicate === true } }];
}

const phone = incoming.phone;
const nowMs = Date.now();
const ttlMs = (Number(root.config.sessionTtlMinutes) || 120) * 60000;
for (const key of Object.keys(staticData.sessions)) {
  const sess = staticData.sessions[key];
  const at = sess && sess.updatedAt ? new Date(sess.updatedAt).getTime() : 0;
  if (!at || nowMs - at > ttlMs) delete staticData.sessions[key];
}

const result = handleTurn({
  config: root.config,
  session: staticData.sessions[phone] || null,
  profile: staticData.profiles[phone] || null,
  incoming: incoming,
  nowIso: new Date().toISOString(),
});

if (result.profile && result.profile.patientName) {
  staticData.profiles[phone] = { patientName: result.profile.patientName };
}
if (result.session && result.session.step && result.session.step !== 'menu') {
  staticData.sessions[phone] = result.session;
} else {
  delete staticData.sessions[phone];
}

return [{ json: result }];
