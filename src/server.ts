import express from 'express';
import { DateTime } from 'luxon';
import type { AppConfig } from './config';
import { CalendarAccessError } from './errors';
import { handleMessage } from './flow';
import { logger, maskPhone } from './logger';
import type { Store } from './store';
import type { CalendarPort } from './types';
import { parseWebhook, verifyMetaSignature, type WhatsAppSender } from './whatsapp';

export interface AppDeps {
  config: AppConfig;
  store: Store;
  calendar: CalendarPort;
  whatsapp: WhatsAppSender;
  now?: () => DateTime;
}

type RequestWithRaw = express.Request & { rawBody?: Buffer };

export function createApp(deps: AppDeps): express.Express {
  const { config, store, calendar, whatsapp } = deps;
  const now = deps.now ?? (() => DateTime.now());
  const app = express();
  app.disable('x-powered-by');
  app.use(
    express.json({
      limit: '1mb',
      verify: (req, _res, buf) => {
        (req as RequestWithRaw).rawBody = Buffer.from(buf);
      },
    }),
  );

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

  app.get('/webhook', (req, res) => {
    if (!config.whatsapp.verifyToken) {
      res.status(503).type('text/plain').send('Verify token não configurado.');
      return;
    }
    const mode = hubParam(req.query, 'mode');
    const token = hubParam(req.query, 'verify_token');
    const challenge = hubParam(req.query, 'challenge');
    if (mode === 'subscribe' && token === config.whatsapp.verifyToken && challenge) {
      res.status(200).type('text/plain').send(challenge);
      return;
    }
    res.status(403).type('text/plain').send('Verificação recusada.');
  });

  app.post('/webhook', async (req, res) => {
    try {
      if (config.whatsapp.appSecret) {
        const valid = verifyMetaSignature(
          (req as RequestWithRaw).rawBody ?? Buffer.alloc(0),
          req.header('x-hub-signature-256'),
          config.whatsapp.appSecret,
        );
        if (!valid) {
          res.status(403).type('text/plain').send('Assinatura inválida.');
          return;
        }
      }

      const messages = parseWebhook(req.body);
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
            await whatsapp.send(message.phone, reply);
          }
          store.completeMessage(message.messageId);
          await whatsapp.markRead(message.messageId).catch((err: unknown) => {
            logger.warn('whatsapp_read', { message: err instanceof Error ? err.message : String(err) });
          });
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
  if (!config.whatsapp.accessToken || !config.whatsapp.phoneNumberId) {
    logger.warn('WhatsApp incompleto. Defina WHATSAPP_ACCESS_TOKEN e WHATSAPP_PHONE_NUMBER_ID.');
  }
  if (!config.whatsapp.verifyToken) {
    logger.warn('WHATSAPP_VERIFY_TOKEN ausente. A verificação do webhook vai falhar.');
  }
  if (!config.whatsapp.appSecret) {
    logger.warn('WHATSAPP_APP_SECRET ausente. O webhook aceita POST sem assinatura.');
  }
  if (config.google.mode === 'unconfigured') {
    logger.warn('Google Calendar não configurado. Defina GOOGLE_SERVICE_ACCOUNT_JSON e GOOGLE_CALENDAR_ID.');
  }
  if (config.google.mode === 'service_account' && config.google.calendarId === 'primary') {
    logger.warn('GOOGLE_CALENDAR_ID=primary usa a agenda da conta de serviço, não a agenda da clínica.');
  }
}

function hubParam(query: express.Request['query'], name: 'mode' | 'verify_token' | 'challenge'): string | undefined {
  const flat = query[`hub.${name}`];
  if (typeof flat === 'string') return flat;
  const hub = query.hub;
  if (hub && typeof hub === 'object' && name in hub) {
    const value = (hub as Record<string, unknown>)[name];
    if (typeof value === 'string') return value;
  }
  return undefined;
}
