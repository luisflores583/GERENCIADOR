import Link from "next/link";

export function AuthShell({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="arena-bg min-h-screen">
      <div className="h-1.5 bg-ink" />
      <main className="mx-auto grid min-h-[calc(100vh-6px)] max-w-6xl items-center gap-10 px-4 py-10 lg:grid-cols-2">
        <div>
          <Link href="/" className="font-display text-xl font-semibold">
            Ache sua dupla
          </Link>
          <h1 className="mt-6 font-display text-5xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-3 max-w-md text-ink/70">{text}</p>
        </div>
        <div className="card flex flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}
