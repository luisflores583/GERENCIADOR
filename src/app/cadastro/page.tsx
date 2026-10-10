import { redirect } from "next/navigation";
import { Botao } from "@/components/botao";
import { Casco } from "@/components/cabecalho";
import { Campo, Entrada } from "@/components/campo";
import { Formulario } from "@/components/formulario";
import { acaoCadastrar } from "@/server/acoes";
import { obterUsuario } from "@/server/sessao";

export const dynamic = "force-dynamic";

export default async function Cadastro() {
  const usuario = await obterUsuario();
  if (usuario) redirect(usuario.papel === "ADMIN" ? "/admin" : "/atleta");
  return (
    <Casco>
      <div className="mx-auto max-w-lg rounded-[2rem] bg-foam p-6 shadow-card">
        <h1 className="font-display text-4xl text-navy">Criar conta de atleta</h1>
        <Formulario acao={acaoCadastrar} className="mt-6">
          <Campo id="nome" rotulo="Nome completo">
            <Entrada id="nome" name="nome" required autoComplete="name" />
          </Campo>
          <Campo id="apelido" rotulo="Apelido esportivo">
            <Entrada id="apelido" name="apelido" />
          </Campo>
          <Campo id="telefone" rotulo="Telefone / WhatsApp">
            <Entrada id="telefone" name="telefone" autoComplete="tel" />
          </Campo>
          <Campo id="email" rotulo="E-mail">
            <Entrada id="email" name="email" type="email" required autoComplete="email" />
          </Campo>
          <Campo id="senha" rotulo="Senha" dica="Mínimo de 8 caracteres.">
            <Entrada id="senha" name="senha" type="password" required autoComplete="new-password" />
          </Campo>
          <Botao type="submit">Cadastrar</Botao>
        </Formulario>
      </div>
    </Casco>
  );
}
