const routed = $input.first().json;
const list = routed.calendars && routed.calendars.length
  ? routed.calendars
  : [{ id: routed.professionalId, name: '', calendarId: routed.calendarId }];
return list.map((calendar) => ({
  json: {
    calendarId: calendar.calendarId,
    professionalId: calendar.id,
    professionalName: calendar.name,
    timeMin: routed.timeMin,
    timeMax: routed.timeMax,
    query: routed.query,
  },
}));
