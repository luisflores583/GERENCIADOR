import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { loadConfig } from '../src/config';

test('usa o expediente padrão da clínica', () => {
  const config = loadConfig({});
  assert.equal(config.clinic.timezone, 'America/Sao_Paulo');
  assert.equal(config.clinic.open, '08:00');
  assert.equal(config.clinic.close, '18:00');
  assert.equal(config.clinic.sessionMinutes, 50);
  assert.equal(config.clinic.daysAhead, 7);
  assert.deepEqual(config.clinic.weekdays, [1, 2, 3, 4, 5]);
  assert.equal(config.google.mode, 'unconfigured');
  assert.equal(config.evolution.mode, 'unconfigured');
});

test('conta de serviço tem prioridade e o caminho do JSON é absoluto', () => {
  const config = loadConfig({
    GOOGLE_SERVICE_ACCOUNT_JSON: './secrets/sa.json',
    GOOGLE_CALENDAR_ID: 'agenda@group.calendar.google.com',
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 'secret',
    GOOGLE_REFRESH_TOKEN: 'refresh',
    CLINIC_OPEN: '09:30',
    CLINIC_CLOSE: '17:00',
    CLINIC_SESSION_MINUTES: '40',
  });
  assert.equal(config.google.mode, 'service_account');
  if (config.google.mode !== 'service_account') return;
  assert.equal(config.google.calendarId, 'agenda@group.calendar.google.com');
  assert.equal(config.google.keyFile, path.resolve(process.cwd(), 'secrets/sa.json'));
  assert.equal(config.clinic.open, '09:30');
  assert.equal(config.clinic.sessionMinutes, 40);
});

test('usa OAuth quando não há conta de serviço', () => {
  const config = loadConfig({
    GOOGLE_CLIENT_ID: 'id',
    GOOGLE_CLIENT_SECRET: 'secret',
    GOOGLE_REFRESH_TOKEN: 'refresh',
    GOOGLE_CALENDAR_ID: 'primary',
  });
  assert.equal(config.google.mode, 'oauth');
});

test('lê a Evolution API e recusa configuração incompleta', () => {
  const config = loadConfig({
    EVOLUTION_API_URL: 'http://localhost:8080/',
    EVOLUTION_INSTANCE: 'clinica',
    EVOLUTION_API_KEY: 'segredo',
  });
  assert.equal(config.evolution.mode, 'configured');
  if (config.evolution.mode === 'configured') {
    assert.equal(config.evolution.baseUrl, 'http://localhost:8080');
    assert.equal(config.evolution.instance, 'clinica');
    assert.equal(config.evolution.apiKey, 'segredo');
  }
  assert.throws(() => loadConfig({ EVOLUTION_API_URL: 'http://localhost:8080' }), /EVOLUTION_INSTANCE/);
  assert.throws(() => loadConfig({ EVOLUTION_API_URL: 'ftp://localhost' , EVOLUTION_INSTANCE: 'a', EVOLUTION_API_KEY: 'b' }), /http/);
  assert.throws(() => loadConfig({ GOOGLE_CALENDAR_ID: 'abc' }), /GOOGLE_SERVICE_ACCOUNT_JSON|OAuth/);
  assert.throws(() => loadConfig({ CLINIC_OPEN: '18:00', CLINIC_CLOSE: '08:00' }), /CLINIC_SESSION_MINUTES/);
  assert.throws(() => loadConfig({ CLINIC_TIMEZONE: 'Nao/Existe' }), /CLINIC_TIMEZONE/);
  assert.throws(() => loadConfig({ CLINIC_WEEKDAYS: '0,1' }), /CLINIC_WEEKDAYS/);
});
