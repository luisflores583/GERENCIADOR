const FUSO = "America/Sao_Paulo";

export function formatarData(data: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(data));
}

export function formatarHora(data: Date | string): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: FUSO,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(data));
}

export function formatarDataHora(data: Date | string): string {
  return `${formatarData(data)} ${formatarHora(data)}`;
}

export function interpretarDataHoraLocal(valor: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) {
    throw new Error("Informe data e horário no formato DD/MM/AAAA, 24 horas.");
  }
  return new Date(`${valor}:00-03:00`);
}

export function paraCampoDataHora(data: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(data);
  const mapa = Object.fromEntries(partes.map((parte) => [parte.type, parte.value]));
  return `${mapa.year}-${mapa.month}-${mapa.day}T${mapa.hour}:${mapa.minute}`;
}

export function formatarMoeda(centavos: number | null | undefined): string {
  if (centavos == null) return "Gratuita";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
}

export function centavosDeReais(valor: string): number | null {
  const limpo = valor.trim();
  if (!limpo) return null;
  const normalizado = limpo.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) {
    throw new Error("Informe o valor da inscrição em reais, por exemplo 50,00.");
  }
  return Math.round(Number(normalizado) * 100);
}

export function slugificar(texto: string): string {
  const base = texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "torneio";
}
