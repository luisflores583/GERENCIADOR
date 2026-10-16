import { assinar } from "@/engine/tempo-real";
import { prisma } from "@/server/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, contexto: { params: Promise<{ slug: string }> }) {
  const { slug } = await contexto.params;
  const torneio = await prisma.torneio.findUnique({ where: { slug }, select: { id: true } });
  if (!torneio) return new Response("Não encontrado", { status: 404 });

  const encoder = new TextEncoder();
  let cancelar = () => {};
  let ping: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const enviar = (texto: string) => {
        try {
          controller.enqueue(encoder.encode(texto));
        } catch {
          /* conexão encerrada */
        }
      };
      enviar(`data: ${JSON.stringify({ tipo: "conectado" })}\n\n`);
      cancelar = assinar(torneio.id, (evento) => {
        enviar(`data: ${JSON.stringify(evento)}\n\n`);
      });
      ping = setInterval(() => enviar(`: ping\n\n`), 15000);
      req.signal.addEventListener("abort", () => {
        if (ping) clearInterval(ping);
        cancelar();
        try {
          controller.close();
        } catch {
          /* já fechado */
        }
      });
    },
    cancel() {
      if (ping) clearInterval(ping);
      cancelar();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
