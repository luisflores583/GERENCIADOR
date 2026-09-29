"use client";

import { FormEvent, useEffect, useState } from "react";

export default function ConfiguracoesPage() {
  const [form, setForm] = useState({
    displayName: "",
    phone: "",
    bio: "",
    cancellationHours: "2",
    organizationName: "",
    name: "",
  });
  const [msg, setMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        const p = d.professional;
        if (!p) return;
        setForm({
          displayName: p.displayName || "",
          phone: p.phone || "",
          bio: p.bio || "",
          cancellationHours: String(p.cancellationHours ?? 2),
          organizationName: p.organization?.name || "",
          name: p.user?.name || "",
        });
      });
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        cancellationHours: Number(form.cancellationHours),
      }),
    });
    if (!res.ok) {
      setMsg("Erro ao salvar");
      return;
    }
    setMsg("Configurações atualizadas");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Configurações</h1>
        <p className="mt-1 text-sm text-ink-700/70">
          Perfil, política de cancelamento e PWA
        </p>
      </div>

      <form onSubmit={onSubmit} className="card-panel grid gap-3 p-5 sm:grid-cols-2">
        <div>
          <label className="label-field">Nome do studio</label>
          <input
            className="input-field"
            value={form.organizationName}
            onChange={(e) => setForm({ ...form, organizationName: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">Nome de exibição</label>
          <input
            className="input-field"
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">Telefone</label>
          <input
            className="input-field"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">Antecedência cancelamento (h)</label>
          <select
            className="input-field"
            value={form.cancellationHours}
            onChange={(e) => setForm({ ...form, cancellationHours: e.target.value })}
          >
            <option value="2">2 horas</option>
            <option value="12">12 horas</option>
            <option value="24">24 horas</option>
            <option value="48">48 horas</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label-field">Bio</label>
          <textarea
            className="input-field min-h-[80px]"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </div>
        <button className="btn-primary sm:col-span-2 sm:w-fit" type="submit">
          Salvar
        </button>
      </form>
      {msg && <p className="text-sm text-blush-700">{msg}</p>}

      <section className="card-panel p-5 text-sm text-ink-700/80">
        <h2 className="font-display text-xl text-ink-900">PWA</h2>
        <p className="mt-2">
          O app inclui <code>manifest.webmanifest</code> e pode ser instalado no celular
          (Adicionar à tela inicial). Theme color: blush.
        </p>
      </section>
    </div>
  );
}
