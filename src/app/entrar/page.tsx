import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/inicio");
  return (
    <AuthShell title="Entrar" text="Use sua conta da arena. Não há login externo.">
      <LoginForm />
      <p className="text-sm text-ink/70">
        Ainda não tem conta?{" "}
        <Link className="font-semibold text-pine" href="/cadastro">
          Cadastre-se
        </Link>
      </p>
      <details className="rounded-2xl bg-sand px-4 py-3 text-sm">
        <summary className="cursor-pointer font-semibold">Todas as contas de demonstração</summary>
        <p className="mt-2 text-ink/70">Senha: {DEMO_PASSWORD}</p>
        <ul className="mt-2 space-y-1">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <span className="font-medium">{account.email}</span>
              <span className="text-ink/60"> — {account.note}</span>
            </li>
          ))}
        </ul>
      </details>
    </AuthShell>
  );
}
