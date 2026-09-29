"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatBRL } from "@/lib/constants";

type Client = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  _count: { appointments: number };
  totalSpentCents: number;
};

export default function ClientesPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "" });
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await fetch("/api/clients").then((r) => r.json());
    setClients(data.clients || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setMsg("");
    const url = editing ? `/api/clients/${editing}` : "/api/clients";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Erro");
      return;
    }
    setForm({ name: "", phone: "", email: "", notes: "" });
    setEditing(null);
    setMsg(editing ? "Cliente atualizado" : "Cliente criado");
    load();
  }

  function startEdit(c: Client) {
    setEditing(c.id);
    setForm({
      name: c.name,
      phone: c.phone,
      email: c.email || "",
      notes: c.notes || "",
    });
  }

  async function remove(id: string) {
    if (!confirm("Excluir cliente?")) return;
    await fetch(`/api/clients/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Clientes</h1>
        <p className="mt-1 text-sm text-ink-700/70">Cadastro e histórico</p>
      </div>

      <form onSubmit={onSubmit} className="card-panel grid gap-3 p-5 sm:grid-cols-2">
        <div>
          <label className="label-field">Nome</label>
          <input
            className="input-field"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">WhatsApp</label>
          <input
            className="input-field"
            required
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">E-mail</label>
          <input
            className="input-field"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">Observações</label>
          <input
            className="input-field"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 flex gap-2">
          <button className="btn-primary" type="submit">
            {editing ? "Salvar" : "Adicionar"}
          </button>
          {editing && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditing(null);
                setForm({ name: "", phone: "", email: "", notes: "" });
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      {msg && <p className="text-sm text-blush-700">{msg}</p>}

      <div className="card-panel divide-y divide-[#efe7e3]">
        {clients.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-ink-700/70">
                {c.phone}
                {c.email ? ` · ${c.email}` : ""}
              </p>
              <p className="text-xs text-ink-700/50">
                {c._count.appointments} agendamentos · total {formatBRL(c.totalSpentCents)}
              </p>
            </div>
            <div className="flex gap-2">
              <button className="btn-secondary !py-1.5 text-xs" onClick={() => startEdit(c)}>
                Editar
              </button>
              <button className="btn-secondary !py-1.5 text-xs" onClick={() => remove(c.id)}>
                Excluir
              </button>
            </div>
          </div>
        ))}
        {!clients.length && (
          <p className="p-4 text-sm text-ink-700/60">Nenhum cliente ainda.</p>
        )}
      </div>
    </div>
  );
}
