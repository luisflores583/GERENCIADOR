import { DateTime } from 'luxon';
import type { ClinicConfig } from './config';

const WEEKDAY_SHORT = ['', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
const WEEKDAY_LONG = ['', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado', 'domingo'];
const WEEKDAY_MEDIUM = ['', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];

const COMMANDS = new Set([
  'agendar',
  'marcar',
  'remarcar',
  'reagendar',
  'cancelar',
  'desmarcar',
  'menu',
  'inicio',
  'voltar',
  'oi',
  'ola',
  'bom dia',
  'boa tarde',
  'boa noite',
  'ajuda',
  'comecar',
  'sim',
  'nao',
  'ok',
  'pode',
  'confirmar',
  'confirma',
  'outro',
  'outro horario',
  'trocar',
  'manter',
  'manter sessao',
]);

export function normalize(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function digits(phone: string): string {
  return phone.replace(/\D/g, '');
}

export function parsePatientName(input: string): string | null {
  const name = input
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
  if (name.length < 2 || name.length > 80) return null;
  if (!/\p{L}/u.test(name)) return null;
  if (COMMANDS.has(normalize(name))) return null;
  return name;
}

export function firstName(name: string): string {
  return name.split(' ')[0] || name;
}

export function weekdayPhrase(days: number[]): string {
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  if (sorted.join(',') === '1,2,3,4,5') return 'segunda a sexta';
  return sorted.map((day) => WEEKDAY_MEDIUM[day]).filter(Boolean).join(', ');
}

export function scheduleFooter(clinic: ClinicConfig): string {
  const phrase = weekdayPhrase(clinic.weekdays);
  const compact = phrase === 'segunda a sexta' ? 'seg a sex' : phrase;
  return `${compact} · ${clinic.open}–${clinic.close}`.slice(0, 60);
}

export function formatSlotShort(iso: string, zone: string): string {
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(zone);
  if (!dt.isValid) return iso.slice(0, 24);
  const raw = WEEKDAY_SHORT[dt.weekday] ?? '';
  const weekday = raw ? raw.charAt(0).toLocaleUpperCase('pt-BR') + raw.slice(1) : '';
  return `${weekday} ${dt.toFormat('dd/LL HH:mm')}`.trim();
}

export function formatSlotLong(iso: string, zone: string): string {
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(zone);
  if (!dt.isValid) return iso;
  const raw = WEEKDAY_LONG[dt.weekday] ?? '';
  const weekday = raw ? raw.charAt(0).toLocaleUpperCase('pt-BR') + raw.slice(1) : '';
  return `${weekday}, ${dt.toFormat('dd/LL/yyyy')}, às ${dt.toFormat('HH:mm')}`;
}

export function formatTime(iso: string, zone: string): string {
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(zone);
  return dt.isValid ? dt.toFormat('HH:mm') : '';
}

export function localDateTime(iso: string, zone: string): string {
  const dt = DateTime.fromISO(iso, { setZone: true }).setZone(zone);
  if (!dt.isValid) {
    throw new Error(`Horário inválido: ${iso}`);
  }
  return dt.toFormat("yyyy-MM-dd'T'HH:mm:ss");
}
