import { Casco } from "@/components/cabecalho";
import { Campo, Entrada } from "@/components/campo";
import { Botao } from "@/components/botao";
import { Formulario } from "@/components/formulario";
import { acaoEntrar } from "@/server/acoes";
import { obterUsuario } from "@/server/sessao";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Entrar() {
  const usuario = await obterUsuario();
  if (usuario?.papel === "ADMIN") redirect("/admin");
  if (usuario?.papel === "ATLETA") redirect("/atleta");
  const demo = process.env.EXIBIR_ACESSO_DEMO === "true";
  return (
    <Casco>
      <div className="mx-auto max-w-lg rounded-[2rem] bg-foam p-6 shadow-card">
        <h1 className="font-display text-4xl text-navy">Entrar</h1>
        <p className="mt-2 text-navy/70">Administrador e atleta usam a mesma porta. O perfil abre o caminho certo.</p>
        <Formulario acao={acaoEntrar} className="mt-6">
          <Campo id="email" rotulo="E-mail">
            <Entrada id="email" name="email" type="email" autoComplete="username" required />
          </Campo>
          <Campo id="senha" rotulo="Senha">
            <Entrada id="senha" name="senha" type="password" autoComplete="current-password" required />
          </Campo>
          <Botao type="submit">Entrar</Botao>
        </Formulario>
        {demo ? (
          <aside className="mt-6 rounded-2xl bg-sand p-4 text-sm text-navy">
            <p className="font-semibold">Demonstração local</p>
            <p>Admin: {process.env.SEED_ADMIN_EMAIL} / {process.env.SEED_ADMIN_PASSWORD}</p>
            <p>Atleta: ana@arena.local / {process.env.SEED_ATHLETE_PASSWORD}</p>
          </aside>
        ) : null}
      </div>
    </Casco>
  );
}
