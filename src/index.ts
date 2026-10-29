import 'dotenv/config';
import { loadConfig } from './config';
import { createCalendar } from './calendar';
import { logger } from './logger';
import { createApp, warnIfIncomplete } from './server';
import { SqliteStore } from './store';
import { WhatsAppClient } from './whatsapp';

const config = loadConfig(process.env);
warnIfIncomplete(config);

const store = new SqliteStore(config.dataPath);
const calendar = createCalendar({ clinic: config.clinic, google: config.google });
const whatsapp = new WhatsAppClient(config.whatsapp);
const app = createApp({ config, store, calendar, whatsapp });

const server = app.listen(config.port, () => {
  logger.info('servidor', {
    port: config.port,
    calendar: config.google.mode,
    webhook: '/webhook',
    availability: '/api/calendar/availability',
  });
});

function shutdown(): void {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
