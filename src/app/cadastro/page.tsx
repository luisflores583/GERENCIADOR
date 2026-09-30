import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/inicio");
  return (
    <AuthShell title="Criar conta" text="Nome, e-mail e senha. Depois você escolhe os esportes e a disponibilidade.">
      <SignupForm />
      <p className="text-sm text-ink/70">
        Já tem conta?{" "}
        <Link className="font-semibold text-pine" href="/entrar">
          Entrar
        </Link>
      </p>
    </AuthShell>
  );
}
