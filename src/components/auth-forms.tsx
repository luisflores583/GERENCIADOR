"use client";

import { useActionState } from "react";
import { loginAction, signupAction, type FormState } from "@/actions/auth";
import { DEMO_PASSWORD } from "@/lib/constants";

const initial: FormState = { error: "" };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initial);
  return (
    <div className="flex flex-col gap-6">
      <form action={action} className="flex flex-col gap-3">
        {state.error && (
          <p role="alert" className="rounded-2xl bg-clay/10 px-4 py-3 text-sm text-clay">
            {state.error}
          </p>
        )}
        <label className="text-sm font-medium" htmlFor="email">
          E-mail
        </label>
        <input className="field" id="email" name="email" type="email" autoComplete="username" required placeholder="ana.souza@arena.local" />
        <label className="text-sm font-medium" htmlFor="password">
          Senha
        </label>
        <input className="field" id="password" name="password" type="password" autoComplete="current-password" required />
        <button className="btn-primary mt-2" type="submit" disabled={pending}>
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
      <div>
        <p className="kicker">Atalhos da demonstração</p>
        <p className="mt-2 text-sm text-ink/70">Senha de todas as contas: {DEMO_PASSWORD}</p>
        <div className="mt-3 grid gap-2">
          <DemoButton action={action} email="ana.souza@arena.local" label="Entrar como Ana Souza" hint="Dupla, desafio pendente e jogo na agenda" />
          <DemoButton action={action} email="elena.costa@arena.local" label="Entrar como Elena Costa" hint="Pode responder ao horário que a Ana propuser" />
          <DemoButton action={action} email="gabriela.nunes@arena.local" label="Entrar como Gabriela Nunes" hint="Tem um convite de dupla para aceitar ou recusar" />
        </div>
      </div>
    </div>
  );
}

function DemoButton({
  action,
  email,
  label,
  hint,
}: {
  action: (payload: FormData) => void;
  email: string;
  label: string;
  hint: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="password" value={DEMO_PASSWORD} />
      <button className="btn-ghost w-full flex-col items-start text-left" type="submit">
        <span>{label}</span>
        <span className="text-xs font-normal text-ink/60">{hint}</span>
      </button>
    </form>
  );
}

export function SignupForm() {
  const [state, action, pending] = useActionState(signupAction, initial);
  return (
    <form action={action} className="flex flex-col gap-3">
      {state.error && (
        <p role="alert" className="rounded-2xl bg-clay/10 px-4 py-3 text-sm text-clay">
          {state.error}
        </p>
      )}
      <label className="text-sm font-medium" htmlFor="name">
        Nome
      </label>
      <input className="field" id="name" name="name" required minLength={2} maxLength={80} placeholder="Seu nome" />
      <label className="text-sm font-medium" htmlFor="signup-email">
        E-mail
      </label>
      <input className="field" id="signup-email" name="email" type="email" autoComplete="username" required placeholder="voce@email.com" />
      <label className="text-sm font-medium" htmlFor="signup-password">
        Senha
      </label>
      <input className="field" id="signup-password" name="password" type="password" autoComplete="new-password" required minLength={6} />
      <label className="text-sm font-medium" htmlFor="confirm">
        Confirmar senha
      </label>
      <input className="field" id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={6} />
      <button className="btn-primary mt-2" type="submit" disabled={pending}>
        {pending ? "Criando conta..." : "Criar conta"}
      </button>
    </form>
  );
}
