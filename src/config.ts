import path from 'node:path';
import { DateTime } from 'luxon';

export interface ClinicConfig {
  name: string;
  timezone: string;
  open: string;
  close: string;
  sessionMinutes: number;
  daysAhead: number;
  weekdays: number[];
  minNoticeMinutes: number;
}

export type EvolutionConfig =
  | { mode: 'configured'; baseUrl: string; instance: string; apiKey: string }
  | { mode: 'unconfigured' };

export type GoogleConfig =
  | { mode: 'service_account'; keyFile: string; calendarId: string }
  | { mode: 'oauth'; clientId: string; clientSecret: string; refreshToken: string; calendarId: string }
  | { mode: 'unconfigured' };

export interface AppConfig {
  port: number;
  dataPath: string;
  clinic: ClinicConfig;
  evolution: EvolutionConfig;
  google: GoogleConfig;
  checkToken?: string;
}

export function parseClock(value: string, name: string): { hour: number; minute: number } {
  const match = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) {
    throw new Error(`${name} deve estar no formato HH:mm.`);
  }
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) {
    throw new Error(`${name} inválido.`);
  }
  return { hour, minute };
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const open = env.CLINIC_OPEN?.trim() || '08:00';
  const close = env.CLINIC_CLOSE?.trim() || '18:00';
  const sessionMinutes = intEnv(env.CLINIC_SESSION_MINUTES, 50, 10, 240, 'CLINIC_SESSION_MINUTES');
  const openParts = parseClock(open, 'CLINIC_OPEN');
  const closeParts = parseClock(close, 'CLINIC_CLOSE');
  const openMinutes = openParts.hour * 60 + openParts.minute;
  const closeMinutes = closeParts.hour * 60 + closeParts.minute;
  if (closeMinutes - openMinutes < sessionMinutes) {
    throw new Error('CLINIC_SESSION_MINUTES não cabe entre CLINIC_OPEN e CLINIC_CLOSE.');
  }

  const timezone = env.CLINIC_TIMEZONE?.trim() || 'America/Sao_Paulo';
  if (!DateTime.now().setZone(timezone).isValid) {
    throw new Error(`CLINIC_TIMEZONE inválido: ${timezone}`);
  }

  const checkToken = env.INTERNAL_CHECK_TOKEN?.trim();

  return {
    port: intEnv(env.PORT, 3000, 1, 65535, 'PORT'),
    dataPath: path.resolve(process.cwd(), env.DATA_PATH?.trim() || './data/clinic.sqlite'),
    clinic: {
      name: env.CLINIC_NAME?.trim() || 'Consultório de Fisioterapia',
      timezone,
      open,
      close,
      sessionMinutes,
      daysAhead: intEnv(env.CLINIC_DAYS_AHEAD, 7, 1, 31, 'CLINIC_DAYS_AHEAD'),
      weekdays: parseWeekdays(env.CLINIC_WEEKDAYS),
      minNoticeMinutes: intEnv(env.CLINIC_MIN_NOTICE_MINUTES, 0, 0, 24 * 60, 'CLINIC_MIN_NOTICE_MINUTES'),
    },
    evolution: loadEvolution(env),
    google: loadGoogle(env),
    ...(checkToken ? { checkToken } : {}),
  };
}

function loadEvolution(env: NodeJS.ProcessEnv): EvolutionConfig {
  const baseUrl = env.EVOLUTION_API_URL?.trim().replace(/\/+$/, '') ?? '';
  const instance = env.EVOLUTION_INSTANCE?.trim() ?? '';
  const apiKey = env.EVOLUTION_API_KEY?.trim() ?? '';
  if (!baseUrl && !instance && !apiKey) return { mode: 'unconfigured' };
  if (!baseUrl || !instance || !apiKey) {
    throw new Error('Defina EVOLUTION_API_URL, EVOLUTION_INSTANCE e EVOLUTION_API_KEY.');
  }
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw new Error('EVOLUTION_API_URL inválida.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('EVOLUTION_API_URL deve começar com http:// ou https://.');
  }
  return { mode: 'configured', baseUrl, instance, apiKey };
}

function loadGoogle(env: NodeJS.ProcessEnv): GoogleConfig {
  const keyFileRaw = env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim();
  const calendarId = env.GOOGLE_CALENDAR_ID?.trim();
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = env.GOOGLE_REFRESH_TOKEN?.trim();
  const hasService = Boolean(keyFileRaw);
  const hasOauth = Boolean(clientId || clientSecret || refreshToken);

  if (!hasService && !hasOauth && !calendarId) {
    return { mode: 'unconfigured' };
  }
  if (!calendarId) {
    throw new Error('Defina GOOGLE_CALENDAR_ID.');
  }
  if (hasService) {
    return {
      mode: 'service_account',
      keyFile: path.resolve(process.cwd(), keyFileRaw!),
      calendarId,
    };
  }
  if (clientId && clientSecret && refreshToken) {
    return { mode: 'oauth', clientId, clientSecret, refreshToken, calendarId };
  }
  throw new Error(
    'Configure a conta de serviço (GOOGLE_SERVICE_ACCOUNT_JSON) ou o OAuth completo (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN).',
  );
}

function parseWeekdays(value: string | undefined): number[] {
  const raw = (value?.trim() || '1,2,3,4,5').split(',').map((part) => part.trim()).filter(Boolean);
  const days = raw.map((part) => Number(part));
  if (days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) {
    throw new Error('CLINIC_WEEKDAYS deve ser uma lista de 1 (segunda) a 7 (domingo).');
  }
  return [...new Set(days)];
}

function intEnv(value: string | undefined, fallback: number, min: number, max: number, name: string): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return parsed;
}
