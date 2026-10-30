const config = $input.first().json.config;
if (!config || !config.professionals || !config.professionals.length) return [];
if (String(config.whatsappPhoneNumberId || '').indexOf('SEU_PHONE_NUMBER_ID') !== -1) return [];
const unconfigured = config.professionals.some((pro) => {
  const id = String((pro && pro.calendarId) || '');
  return !id || id.indexOf('SEU_CALENDAR_ID') !== -1;
});
if (unconfigured) return [];
const now = new Date();
const hours = Number(config.reminderLookaheadHours) || 26;
const timeMax = new Date(now.getTime() + hours * 3600000).toISOString();
return config.professionals.map((pro) => ({
  json: {
    calendarId: pro.calendarId,
    professionalId: pro.id,
    professionalName: pro.name,
    timeMin: now.toISOString(),
    timeMax: timeMax,
    query: 'ID_PACIENTE',
  },
}));
