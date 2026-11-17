import { Botao } from "@/components/botao";
import { CamposTorneio } from "@/components/campos-torneio";
import { Formulario } from "@/components/formulario";
import { acaoCriarTorneio } from "@/server/acoes";

export default function NovoTorneio() {
  return (
    <div>
      <h1 className="font-display text-4xl text-navy">Novo torneio</h1>
      <Formulario acao={acaoCriarTorneio} className="mt-6 rounded-[2rem] bg-foam p-6 shadow-card">
        <CamposTorneio />
        <Botao type="submit">Criar torneio</Botao>
      </Formulario>
    </div>
  );
}
