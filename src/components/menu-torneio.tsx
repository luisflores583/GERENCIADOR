import Link from "next/link";

const ITENS = [
  ["", "Visão"],
  ["/inscricoes", "Inscrições"],
  ["/sorteio", "Sorteio"],
  ["/jogos", "Resultados"],
  ["/quadras", "Quadras"],
  ["/encerramento", "Encerramento"],
];

export function MenuTorneio({ id, slug }: { id: string; slug: string }) {
  return (
    <nav className="mb-6 flex gap-2 overflow-x-auto pb-1" aria-label="Seções do torneio">
      {ITENS.map(([href, rotulo]) => (
        <Link
          key={href}
          href={`/admin/torneios/${id}${href}`}
          className="inline-flex min-h-14 shrink-0 items-center rounded-2xl bg-white px-4 text-base font-semibold text-navy shadow-card"
        >
          {rotulo}
        </Link>
      ))}
      <Link
        href={`/ao-vivo/${slug}`}
        className="inline-flex min-h-14 shrink-0 items-center rounded-2xl bg-coral px-4 text-base font-semibold text-white"
      >
        Painel ao vivo
      </Link>
    </nav>
  );
}
