import { Botao } from "@/components/botao";
import { Campo, Entrada } from "@/components/campo";
import { Formulario } from "@/components/formulario";
import { acaoFoto, acaoPerfil } from "@/server/acoes";
import { exigirAtleta } from "@/server/sessao";

export default async function Perfil() {
  const { atleta } = await exigirAtleta();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-[2rem] bg-foam p-6 shadow-card">
        <h1 className="font-display text-4xl text-navy">Meus dados</h1>
        {atleta.fotoUrl ? <img src={atleta.fotoUrl} alt="" className="mt-4 h-28 w-28 rounded-full object-cover" /> : null}
        <Formulario acao={acaoPerfil} className="mt-4">
          <Campo id="nome" rotulo="Nome completo">
            <Entrada id="nome" name="nome" required defaultValue={atleta.nomeCompleto} />
          </Campo>
          <Campo id="apelido" rotulo="Apelido">
            <Entrada id="apelido" name="apelido" defaultValue={atleta.apelido ?? ""} />
          </Campo>
          <Campo id="telefone" rotulo="Telefone / WhatsApp">
            <Entrada id="telefone" name="telefone" defaultValue={atleta.telefone ?? ""} />
          </Campo>
          <Botao type="submit">Salvar</Botao>
        </Formulario>
      </section>
      <Formulario acao={acaoFoto} className="h-fit rounded-[2rem] bg-foam p-6 shadow-card">
        <h2 className="font-display text-2xl">Foto</h2>
        <Campo id="foto" rotulo="Imagem JPG, PNG ou WebP até 2 MB">
          <Entrada id="foto" name="foto" type="file" accept="image/jpeg,image/png,image/webp" />
        </Campo>
        <Botao type="submit" variante="navy">Enviar foto</Botao>
      </Formulario>
    </div>
  );
}
