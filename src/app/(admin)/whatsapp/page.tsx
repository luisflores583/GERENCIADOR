"use client";

import { FormEvent, useEffect, useState } from "react";

type Msg = { id: string; phone: string; direction: string; body: string; createdAt: string };

export default function WhatsAppPage() {
  const [settings, setSettings] = useState({
    welcomeMessage: "",
    humanHandoffNote: "",
    verifyToken: "",
    provider: "mock",
  });
  const [messages, setMessages] = useState<Msg[]>([]);
  const [sim, setSim] = useState({ phone: "11977776666", body: "0" });
  const [replies, setReplies] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  async function load() {
    const data = await fetch("/api/whatsapp").then((r) => r.json());
    if (data.settings) {
      setSettings({
        welcomeMessage: data.settings.welcomeMessage || "",
        humanHandoffNote: data.settings.humanHandoffNote || "",
        verifyToken: data.settings.verifyToken || "",
        provider: data.settings.provider || "mock",
      });
    }
    setMessages(data.messages || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function saveSettings(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/whatsapp", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setMsg("Configurações salvas");
    load();
  }

  async function simulate(e: FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/whatsapp/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sim),
    });
    const data = await res.json();
    setReplies(data.replies || []);
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">WhatsApp</h1>
        <p className="mt-1 text-sm text-ink-700/70">
          Bot numérico, webhook e simulador (provider mock)
        </p>
      </div>

      <form onSubmit={saveSettings} className="card-panel space-y-3 p-5">
        <div>
          <label className="label-field">Mensagem de boas-vindas</label>
          <textarea
            className="input-field min-h-[80px]"
            value={settings.welcomeMessage}
            onChange={(e) => setSettings({ ...settings, welcomeMessage: e.target.value })}
          />
        </div>
        <div>
          <label className="label-field">Transferência humano</label>
          <textarea
            className="input-field min-h-[60px]"
            value={settings.humanHandoffNote}
            onChange={(e) =>
              setSettings({ ...settings, humanHandoffNote: e.target.value })
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label-field">Verify token</label>
            <input
              className="input-field"
              value={settings.verifyToken}
              onChange={(e) => setSettings({ ...settings, verifyToken: e.target.value })}
            />
          </div>
          <div>
            <label className="label-field">Provider</label>
            <input className="input-field" value={settings.provider} disabled />
          </div>
        </div>
        <button className="btn-primary" type="submit">
          Salvar
        </button>
        {msg && <p className="text-sm text-blush-700">{msg}</p>}
      </form>

      <section className="card-panel p-5">
        <h2 className="font-display text-xl">Simulador do bot</h2>
        <p className="mt-1 text-sm text-ink-700/70">
          Envie mensagens como se fossem do WhatsApp. Comece com <strong>0</strong> para o
          menu.
        </p>
        <form onSubmit={simulate} className="mt-4 grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
          <input
            className="input-field"
            placeholder="Telefone"
            value={sim.phone}
            onChange={(e) => setSim({ ...sim, phone: e.target.value })}
          />
          <input
            className="input-field"
            placeholder="Mensagem"
            value={sim.body}
            onChange={(e) => setSim({ ...sim, body: e.target.value })}
          />
          <button className="btn-primary" type="submit">
            Enviar
          </button>
        </form>
        {!!replies.length && (
          <div className="mt-4 space-y-2 rounded-xl bg-blush-50 p-4 text-sm whitespace-pre-wrap">
            {replies.map((r, i) => (
              <p key={i}>{r}</p>
            ))}
          </div>
        )}
      </section>

      <section className="card-panel p-5">
        <h2 className="font-display text-xl">Mensagens recentes</h2>
        <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
          {messages.map((m) => (
            <li key={m.id} className="rounded-lg border border-[#efe7e3] px-3 py-2">
              <span className="text-xs text-ink-700/50">
                {m.direction === "IN" ? "←" : "→"} {m.phone} ·{" "}
                {new Date(m.createdAt).toLocaleString("pt-BR")}
              </span>
              <p className="whitespace-pre-wrap">{m.body}</p>
            </li>
          ))}
          {!messages.length && <li className="text-ink-700/60">Nenhuma mensagem.</li>}
        </ul>
      </section>
    </div>
  );
}
