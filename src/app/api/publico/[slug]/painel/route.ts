import { montarPainel } from "@/server/consultas";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, contexto: { params: Promise<{ slug: string }> }) {
  const { slug } = await contexto.params;
  const painel = await montarPainel(slug);
  if (!painel) return Response.json({ erro: "Torneio não encontrado." }, { status: 404 });
  return Response.json(painel);
}
