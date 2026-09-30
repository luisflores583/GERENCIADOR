import Link from "next/link";

export default function NotFound() {
  return (
    <main className="arena-bg grid min-h-screen place-items-center px-4">
      <div className="card max-w-md text-center">
        <p className="kicker">Arena</p>
        <h1 className="mt-2 font-display text-4xl">Página não encontrada</h1>
        <Link className="btn-primary mt-5" href="/">
          Voltar ao início
        </Link>
      </div>
    </main>
  );
}
