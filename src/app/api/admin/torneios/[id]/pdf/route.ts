import { gerarPdf } from "@/server/relatorios";
import { montarPainel } from "@/server/consultas";
import { prisma } from "@/server/db";
import { obterUsuario } from "@/server/sessao";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, contexto: { params: Promise<{ id: string }> }) {
  const usuario = await obterUsuario();
  if (!usuario || usuario.papel !== "ADMIN") return new Response("Acesso negado", { status: 403 });
  const { id } = await contexto.params;
  const torneio = await prisma.torneio.findUnique({ where: { id } });
  if (!torneio) return new Response("Não encontrado", { status: 404 });
  const painel = await montarPainel(torneio.slug);
  if (!painel) return new Response("Não encontrado", { status: 404 });
  const pdf = await gerarPdf(painel);
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="resumo-${torneio.slug}.pdf"`,
    },
  });
}
