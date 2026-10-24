import { Casco } from "@/components/cabecalho";
import { exigirAtleta } from "@/server/sessao";

export const dynamic = "force-dynamic";

export default async function LayoutAtleta({ children }: { children: React.ReactNode }) {
  const { usuario } = await exigirAtleta();
  return (
    <Casco nome={usuario.nome} papel="ATLETA">
      {children}
    </Casco>
  );
}
