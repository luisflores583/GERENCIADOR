import 'dotenv/config';
import { createCalendar } from '../calendar';
import { loadConfig } from '../config';
import { formatSlotLong, formatTime } from '../format';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const calendar = createCalendar({ clinic: config.clinic, google: config.google });
  const report = await calendar.inspect();
  const auth =
    report.auth === 'service_account' ? 'conta de serviço' : report.auth === 'oauth' ? 'OAuth' : 'não configurado';

  console.log(`Agenda consultada (${auth}).`);
  if (report.calendarId) console.log(`Calendário: ${report.calendarId}`);
  console.log(`Fuso: ${report.timezone}`);
  console.log(
    `Expediente: ${report.open}–${report.close}, sessões de ${report.sessionMinutes} min, próximos ${report.daysAhead} dias.`,
  );
  console.log('');
  console.log(`Ocupado (${report.busy.length}):`);
  if (report.busy.length === 0) console.log('  (nenhum bloqueio no período)');
  for (const block of report.busy) {
    console.log(`  ${formatSlotLong(block.start, report.timezone)} – ${formatTime(block.end, report.timezone)}`);
  }
  console.log('');
  console.log(`Livres (${report.slots.length}):`);
  if (report.slots.length === 0) console.log('  (nenhum horário livre)');
  for (const slot of report.slots) {
    console.log(`  ${formatSlotLong(slot.start, report.timezone)} – ${formatTime(slot.end, report.timezone)}`);
  }
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
