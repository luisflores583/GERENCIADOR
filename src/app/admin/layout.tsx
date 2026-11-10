import { Casco } from "@/components/cabecalho";
import { exigirAdmin } from "@/server/sessao";

export const dynamic = "force-dynamic";

export default async function LayoutAdmin({ children }: { children: React.ReactNode }) {
  const admin = await exigirAdmin();
  return (
    <Casco nome={admin.nome} papel="ADMIN">
      {children}
    </Casco>
  );
}
