"use client";

export default function Erro({ reset }: { error: Error; reset: () => void }) {
  return (
    <main id="conteudo" className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="font-display text-4xl text-navy">Algo saiu do eixo</h1>
      <p className="mt-3 text-navy/70">Tente de novo em instantes.</p>
      <button type="button" className="mt-6 min-h-14 rounded-2xl bg-coral px-5 text-base font-semibold text-white" onClick={reset}>
        Tentar de novo
      </button>
    </main>
  );
}
