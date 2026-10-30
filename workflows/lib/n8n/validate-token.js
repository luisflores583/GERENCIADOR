const root = $input.first().json;
const query = (root.request && root.request.query) || {};
const hub = query.hub || {};
const mode = query['hub.mode'] || hub.mode || '';
const token = query['hub.verify_token'] || hub.verify_token || '';
const challenge = query['hub.challenge'] || hub.challenge || '';
const expected = root.config && root.config.whatsappVerifyToken;
const ok = mode === 'subscribe' && !!token && token === expected && String(challenge).length > 0;
return [{ json: { ok: ok, challenge: ok ? String(challenge) : '' } }];
