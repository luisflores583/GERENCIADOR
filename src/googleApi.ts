import fs from 'node:fs';
import { google, type calendar_v3 } from 'googleapis';
import type { GoogleConfig } from './config';
import { CalendarAccessError } from './errors';
import type { CalendarEventBody, GoogleEvent } from './types';

export const CALENDAR_SOURCE = 'consultorio-fisioterapia';
const SCOPES = ['https://www.googleapis.com/auth/calendar'];

export interface GoogleCalendarApi {
  queryFreeBusy(timeMin: string, timeMax: string): Promise<{
    busy: { start?: string | null; end?: string | null }[];
    error?: string;
  }>;
  insertEvent(body: CalendarEventBody): Promise<string>;
  patchEvent(eventId: string, body: CalendarEventBody): Promise<void>;
  deleteEvent(eventId: string): Promise<void>;
  listEvents(filter: { phone?: string; messageId?: string; timeMin?: string }): Promise<GoogleEvent[]>;
  getEvent(eventId: string): Promise<GoogleEvent | undefined>;
}

export function createGoogleApi(googleConfig: Exclude<GoogleConfig, { mode: 'unconfigured' }>, timezone: string): GoogleCalendarApi {
  if (googleConfig.mode === 'service_account') {
    assertServiceAccountFile(googleConfig.keyFile);
  }

  const auth =
    googleConfig.mode === 'service_account'
      ? new google.auth.GoogleAuth({ keyFile: googleConfig.keyFile, scopes: SCOPES })
      : oauthClient(googleConfig);

  const calendar = google.calendar({ version: 'v3', auth });
  const calendarId = googleConfig.calendarId;

  return {
    async queryFreeBusy(timeMin, timeMax) {
      const res = await calendar.freebusy.query({
        requestBody: {
          timeMin,
          timeMax,
          timeZone: timezone,
          items: [{ id: calendarId }],
        },
      });
      const calendars = res.data.calendars ?? {};
      const cal = calendars[calendarId] ?? Object.values(calendars)[0];
      if (!cal) return { busy: [], error: 'A resposta do Google não trouxe essa agenda.' };
      const error = cal.errors?.map((item) => item.reason).filter((reason): reason is string => Boolean(reason)).join(', ');
      return { busy: cal.busy ?? [], ...(error ? { error } : {}) };
    },

    async insertEvent(body) {
      const res = await calendar.events.insert({
        calendarId,
        requestBody: toGoogleEvent(body),
      });
      if (!res.data.id) {
        throw new CalendarAccessError('A agenda não devolveu o id do evento.');
      }
      return res.data.id;
    },

    async patchEvent(eventId, body) {
      await calendar.events.patch({
        calendarId,
        eventId,
        requestBody: toGoogleEvent(body),
      });
    },

    async deleteEvent(eventId) {
      await calendar.events.delete({ calendarId, eventId });
    },

    async listEvents(filter) {
      const privateExtendedProperty = [`source=${CALENDAR_SOURCE}`];
      if (filter.phone) privateExtendedProperty.push(`phone=${filter.phone}`);
      if (filter.messageId && isSafeProperty(filter.messageId)) {
        privateExtendedProperty.push(`messageId=${filter.messageId}`);
      }
      const res = await calendar.events.list({
        calendarId,
        singleEvents: true,
        maxResults: 30,
        ...(filter.timeMin ? { timeMin: filter.timeMin, orderBy: 'startTime' as const } : {}),
        privateExtendedProperty,
      });
      return (res.data.items ?? []).map(mapEvent).filter((event): event is GoogleEvent => event !== undefined);
    },

    async getEvent(eventId) {
      try {
        const res = await calendar.events.get({ calendarId, eventId });
        return mapEvent(res.data);
      } catch (err) {
        if (statusOf(err) === 404) return undefined;
        throw err;
      }
    },
  };
}

export function assertServiceAccountFile(file: string): void {
  if (!fs.existsSync(file)) {
    throw new CalendarAccessError(`Arquivo da conta de serviço não encontrado em ${file}.`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new CalendarAccessError(`O arquivo ${file} não é um JSON válido de conta de serviço.`);
  }
  if (!isRecord(parsed) || typeof parsed.client_email !== 'string' || typeof parsed.private_key !== 'string') {
    throw new CalendarAccessError('O JSON da conta de serviço precisa ter client_email e private_key.');
  }
}

function oauthClient(config: Extract<GoogleConfig, { mode: 'oauth' }>) {
  const client = new google.auth.OAuth2(config.clientId, config.clientSecret);
  client.setCredentials({ refresh_token: config.refreshToken });
  return client;
}

function toGoogleEvent(body: CalendarEventBody): calendar_v3.Schema$Event {
  const privateProps: Record<string, string> = {
    source: CALENDAR_SOURCE,
    phone: body.phone,
    patientName: body.patientName,
  };
  if (body.messageId) privateProps.messageId = body.messageId;
  return {
    summary: body.summary,
    description: body.description,
    start: { dateTime: body.start, timeZone: body.timeZone },
    end: { dateTime: body.end, timeZone: body.timeZone },
    transparency: 'opaque',
    status: 'confirmed',
    extendedProperties: { private: privateProps },
  };
}

function mapEvent(item: calendar_v3.Schema$Event): GoogleEvent | undefined {
  const start = item.start?.dateTime;
  const end = item.end?.dateTime;
  if (!item.id || !start || !end || item.status === 'cancelled') return undefined;
  const priv = item.extendedProperties?.private;
  return {
    eventId: item.id,
    start,
    end,
    summary: item.summary ?? '',
    ...(priv?.phone ? { phone: priv.phone } : {}),
    ...(priv?.messageId ? { messageId: priv.messageId } : {}),
  };
}

function isSafeProperty(value: string): boolean {
  return /^[A-Za-z0-9._:-]+$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function statusOf(err: unknown): number | undefined {
  if (!isRecord(err)) return undefined;
  if (typeof err.code === 'number') return err.code;
  if (isRecord(err.response) && typeof err.response.status === 'number') return err.response.status;
  return undefined;
}
