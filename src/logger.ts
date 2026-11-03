export const logger = {
  info(msg: string, extra?: Record<string, unknown>): void {
    console.log(JSON.stringify({ level: 'info', msg, ...extra }));
  },
  warn(msg: string, extra?: Record<string, unknown>): void {
    console.warn(JSON.stringify({ level: 'warn', msg, ...extra }));
  },
  error(msg: string, extra?: Record<string, unknown>): void {
    console.error(JSON.stringify({ level: 'error', msg, ...extra }));
  },
};

export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}
