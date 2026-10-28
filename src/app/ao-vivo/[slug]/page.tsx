import { notFound } from "next/navigation";
import { Casco } from "@/components/cabecalho";
import { PainelAoVivo } from "@/components/painel-ao-vivo";
import { montarPainel } from "@/server/consultas";
import { obterUsuario } from "@/server/sessao";

export const dynamic = "force-dynamic";

export default async function AoVivo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [painel, usuario] = await Promise.all([montarPainel(slug), obterUsuario()]);
  if (!painel) notFound();
  return (
    <Casco nome={usuario?.nome} papel={usuario?.papel}>
      <PainelAoVivo inicial={painel} />
    </Casco>
  );
}
