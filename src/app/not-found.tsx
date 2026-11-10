import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main id="conteudo" className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-display text-4xl text-navy">Página não encontrada</h1>
      <Link className="mt-6 inline-flex min-h-14 items-center rounded-2xl bg-coral px-5 font-semibold text-white" href="/">
        Voltar ao início
      </Link>
    </main>
  );
}
