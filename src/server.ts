import express from 'express';
import { DateTime } from 'luxon';
import type { AppConfig } from './config';
import { CalendarAccessError } from './errors';
import { handleMessage } from './flow';
import { logger, maskPhone } from './logger';
import type { Store } from './store';
import type { CalendarPort } from './types';
import { parseWebhook, type EvolutionSender } from './evolution';

export interface AppDeps {
  config: AppConfig;
  store: Store;
  calendar: CalendarPort;
  evolution: EvolutionSender;
  now?: () => DateTime;
}

export function createApp(deps: AppDeps): express.Express {
  const { config, store, calendar, evolution } = deps;
  const now = deps.now ?? (() => DateTime.now());
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  app.get('/', (_req, res) => {
    res.json({
      service: config.clinic.name,
      health: '/health',
      webhook: '/webhook',
      availability: '/api/calendar/availability',
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'gerenciador' });
  });

  app.get('/webhook', (_req, res) => {
    res.json({
      ok: true,
      webhook: 'evolution',
      event: 'MESSAGES_UPSERT',
    });
  });

  app.post('/webhook', async (req, res) => {
    try {
      const expectedInstance = config.evolution.mode === 'configured' ? config.evolution.instance : undefined;
      const messages = parseWebhook(req.body, expectedInstance);
      for (const message of messages) {
        const state = store.beginMessage(message.messageId);
        if (state !== 'new') continue;
        try {
          let replies = store.getReplies(message.messageId);
          if (!replies) {
            replies = await handleMessage(message, { now, clinic: config.clinic, store, calendar });
            store.saveReplies(message.messageId, replies);
          }
          for (const reply of replies) {
            await evolution.send(message.phone, reply);
          }
          store.completeMessage(message.messageId);
          await evolution.markRead(message.messageId);
          logger.info('mensagem', { phone: maskPhone(message.phone), replies: replies.length });
        } catch (err) {
          store.abortMessage(message.messageId);
          logger.error('webhook_message', {
            phone: maskPhone(message.phone),
            message: err instanceof Error ? err.message : String(err),
          });
          res.status(500).type('text/plain').send('Falha ao processar a mensagem.');
          return;
        }
      }
      res.sendStatus(200);
    } catch (err) {
      logger.error('webhook', { message: err instanceof Error ? err.message : String(err) });
      if (!res.headersSent) res.status(500).type('text/plain').send('Falha ao processar o webhook.');
    }
  });

  app.get('/api/calendar/availability', async (req, res) => {
    if (config.checkToken) {
      const header = req.header('authorization') ?? '';
      const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : undefined;
      const token = bearer || req.header('x-check-token');
      if (token !== config.checkToken) {
        res.status(401).json({ error: 'Não autorizado.' });
        return;
      }
    }
    try {
      const report = await calendar.inspect();
      res.json(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao consultar a agenda.';
      const status = err instanceof CalendarAccessError ? 503 : 500;
      logger.error('calendar_check', { message });
      res.status(status).json({ error: message });
    }
  });

  return app;
}

export function warnIfIncomplete(config: AppConfig): void {
  if (config.evolution.mode === 'unconfigured') {
    logger.warn('Evolution API não configurada. Defina EVOLUTION_API_URL, EVOLUTION_INSTANCE e EVOLUTION_API_KEY.');
  }
  if (config.google.mode === 'unconfigured') {
    logger.warn('Google Calendar não configurado. Defina GOOGLE_SERVICE_ACCOUNT_JSON e GOOGLE_CALENDAR_ID.');
  }
  if (config.google.mode === 'service_account' && config.google.calendarId === 'primary') {
    logger.warn('GOOGLE_CALENDAR_ID=primary usa a agenda da conta de serviço, não a agenda da clínica.');
  }
}

