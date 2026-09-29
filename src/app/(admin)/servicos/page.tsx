"use client";

import { FormEvent, useEffect, useState } from "react";
import { formatBRL } from "@/lib/constants";

type Service = {
  id: string;
  name: string;
  description: string | null;
  priceCents: number;
  durationMin: number;
  category: string | null;
  active: boolean;
};

export default function ServicosPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    durationMin: "45",
    category: "",
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await fetch("/api/services").then((r) => r.json());
    setServices(data.services || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || null,
      priceCents: Math.round(Number(form.price.replace(",", ".")) * 100),
      durationMin: Number(form.durationMin),
      category: form.category || null,
    };
    const res = await fetch(editing ? `/api/services/${editing}` : "/api/services", {
      method: editing ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setMsg(data.error || "Erro");
      return;
    }
    setForm({ name: "", description: "", price: "", durationMin: "45", category: "" });
    setEditing(null);
    setMsg("Salvo");
    load();
  }

  function startEdit(s: Service) {
    setEditing(s.id);
    setForm({
      name: s.name,
      description: s.description || "",
      price: String(s.priceCents / 100),
      durationMin: String(s.durationMin),
      category: s.category || "",
    });
  }

  async function toggleActive(s: Service) {
    await fetch(`/api/services/${s.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Serviços</h1>
        <p className="mt-1 text-sm text-ink-700/70">Preço, duração e disponibilidade</p>
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
          <label className="label-field">Categoria</label>
          <input
            className="input-field"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">Preço (R$)</label>
          <input
            className="input-field"
            required
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">Duração (min)</label>
          <input
            className="input-field"
            type="number"
            min={15}
            step={15}
            required
            value={form.durationMin}
            onChange={(e) => setForm({ ...form, durationMin: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label-field">Descrição</label>
          <input
            className="input-field"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
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
                setForm({
                  name: "",
                  description: "",
                  price: "",
                  durationMin: "45",
                  category: "",
                });
              }}
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
      {msg && <p className="text-sm text-blush-700">{msg}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {services.map((s) => (
          <div key={s.id} className="card-panel p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-ink-700/70">
                  {formatBRL(s.priceCents)} · {s.durationMin} min
                  {s.category ? ` · ${s.category}` : ""}
                </p>
                {s.description && (
                  <p className="mt-1 text-sm text-ink-700/60">{s.description}</p>
                )}
                <p className="mt-1 text-xs">{s.active ? "Ativo" : "Inativo"}</p>
              </div>
              <div className="flex flex-col gap-1">
                <button className="btn-secondary !py-1 text-xs" onClick={() => startEdit(s)}>
                  Editar
                </button>
                <button
                  className="btn-secondary !py-1 text-xs"
                  onClick={() => toggleActive(s)}
                >
                  {s.active ? "Desativar" : "Ativar"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
