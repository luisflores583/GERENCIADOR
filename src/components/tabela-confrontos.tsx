import { textoDoLado } from "@/lib/confronto";

export type LinhaDaTabela = {
  id: string;
  codigo: string;
  status: string;
  equipeA?: { nome: string } | null;
  equipeB?: { nome: string } | null;
};

export function TabelaConfrontos({ partidas }: { partidas: LinhaDaTabela[] }) {
  const linhas = [...partidas]
    .filter((partida) => partida.status !== "VAZIA")
    .sort((a, b) => Number(a.codigo) - Number(b.codigo) || a.codigo.localeCompare(b.codigo, "pt-BR"));

  return (
    <div className="overflow-x-auto rounded-3xl bg-foam shadow-card" data-tabela="confrontos">
      <table className="w-full min-w-[640px] text-left">
        <thead className="bg-navy text-white">
          <tr>
            <th className="px-4 py-3">Jogo</th>
            <th className="px-4 py-3">Confronto</th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((partida) => (
            <tr key={partida.id} className="border-t border-navy/10 bg-white">
              <td className="px-4 py-3 font-semibold text-navy">Jogo {partida.codigo}</td>
              <td className="px-4 py-3 font-semibold text-navy">
                {textoDoLado(partida.equipeA?.nome, partida.status)} x {textoDoLado(partida.equipeB?.nome, partida.status)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
