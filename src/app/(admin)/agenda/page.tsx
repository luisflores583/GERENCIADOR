"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  APPOINTMENT_STATUS,
  PAYMENT_LABELS,
  STATUS_LABELS,
  formatBRL,
  formatDateTime,
} from "@/lib/constants";

type Client = { id: string; name: string };
type Service = { id: string; name: string; priceCents: number; durationMin: number };
type Appt = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  priceCents: number;
  client: Client;
  service: Service;
};

export default function AgendaPage() {
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [form, setForm] = useState({
    clientId: "",
    serviceId: "",
    date: "",
    slot: "",
  });
  const [msg, setMsg] = useState("");

  async function load() {
    const [a, c, s] = await Promise.all([
      fetch("/api/appointments").then((r) => r.json()),
      fetch("/api/clients").then((r) => r.json()),
      fetch("/api/services").then((r) => r.json()),
    ]);
    setAppointments(a.appointments || []);
    setClients(c.clients || []);
    setServices((s.services || []).filter((x: Service & { active?: boolean }) => x));
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!form.serviceId || !form.date) {
      setSlots([]);
      return;
    }
    fetch(`/api/availability?serviceId=${form.serviceId}&date=${form.date}`)
      .then((r) => r.json())
      .then((d) => setSlots(d.slots || []));
  }, [form.serviceId, form.date]);

  const sorted = useMemo(
    () =>
      [...appointments].sort(
        (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      ),
    [appointments]
  );

  async function createAppt(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const startAt = `${form.date}T${form.slot}:00`;
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: form.clientId,
        serviceId: form.serviceId,
        startAt,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Erro ao agendar");
      return;
    }
    setForm({ clientId: "", serviceId: "", date: "", slot: "" });
    setMsg("Agendamento criado");
    load();
  }

  async function setStatus(id: string, status: string, paymentMethod?: string) {
    const res = await fetch(`/api/appointments/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, paymentMethod }),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Erro");
      return;
    }
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Agenda</h1>
        <p className="mt-1 text-sm text-ink-700/70">Crie e gerencie agendamentos</p>
      </div>

      <form onSubmit={createAppt} className="card-panel grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-5">
        <div>
          <label className="label-field">Cliente</label>
          <select
            className="input-field"
            required
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          >
            <option value="">Selecione</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Serviço</label>
          <select
            className="input-field"
            required
            value={form.serviceId}
            onChange={(e) => setForm({ ...form, serviceId: e.target.value, slot: "" })}
          >
            <option value="">Selecione</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-field">Data</label>
          <input
            type="date"
            className="input-field"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value, slot: "" })}
          />
        </div>
        <div>
          <label className="label-field">Horário</label>
          <select
            className="input-field"
            required
            value={form.slot}
            onChange={(e) => setForm({ ...form, slot: e.target.value })}
          >
            <option value="">Selecione</option>
            {slots.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button className="btn-primary w-full" type="submit">
            Agendar
          </button>
        </div>
      </form>
      {msg && <p className="text-sm text-blush-700">{msg}</p>}

      <div className="card-panel overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-[#efe7e3] text-xs uppercase text-ink-700/60">
            <tr>
              <th className="px-4 py-3">Quando</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Serviço</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((a) => (
              <tr key={a.id} className="border-b border-[#f3ebe8]">
                <td className="px-4 py-3">{formatDateTime(a.startAt)}</td>
                <td className="px-4 py-3">{a.client.name}</td>
                <td className="px-4 py-3">
                  {a.service.name}
                  <span className="block text-xs text-ink-700/60">
                    {formatBRL(a.priceCents)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {STATUS_LABELS[a.status as keyof typeof STATUS_LABELS] || a.status}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {a.status === APPOINTMENT_STATUS.SCHEDULED && (
                      <button
                        className="btn-secondary !px-2 !py-1 text-xs"
                        onClick={() => setStatus(a.id, APPOINTMENT_STATUS.CONFIRMED)}
                      >
                        Confirmar
                      </button>
                    )}
                    {[APPOINTMENT_STATUS.SCHEDULED, APPOINTMENT_STATUS.CONFIRMED].includes(
                      a.status as typeof APPOINTMENT_STATUS.SCHEDULED
                    ) && (
                      <button
                        className="btn-secondary !px-2 !py-1 text-xs"
                        onClick={() => setStatus(a.id, APPOINTMENT_STATUS.IN_PROGRESS)}
                      >
                        Atender
                      </button>
                    )}
                    {a.status !== APPOINTMENT_STATUS.COMPLETED &&
                      a.status !== APPOINTMENT_STATUS.CANCELED_CLIENT &&
                      a.status !== APPOINTMENT_STATUS.CANCELED_PRO && (
                        <button
                          className="btn-primary !px-2 !py-1 text-xs"
                          onClick={() =>
                            setStatus(a.id, APPOINTMENT_STATUS.COMPLETED, "PIX")
                          }
                          title={`Pagar via ${PAYMENT_LABELS.PIX}`}
                        >
                          Concluir
                        </button>
                      )}
                    {![
                      APPOINTMENT_STATUS.CANCELED_CLIENT,
                      APPOINTMENT_STATUS.CANCELED_PRO,
                      APPOINTMENT_STATUS.COMPLETED,
                    ].includes(a.status as typeof APPOINTMENT_STATUS.COMPLETED) && (
                      <button
                        className="btn-secondary !px-2 !py-1 text-xs"
                        onClick={() => setStatus(a.id, APPOINTMENT_STATUS.CANCELED_PRO)}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
