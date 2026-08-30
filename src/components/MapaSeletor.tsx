"use client";

import { useRouter } from "next/navigation";
import type { Empreendimento } from "@/lib/db/tipos";

export default function MapaSeletor({
  empreendimentos,
  atual,
}: {
  empreendimentos: Empreendimento[];
  atual: Empreendimento;
}) {
  const router = useRouter();
  if (empreendimentos.length < 2) return null;

  return (
    <select
      className="campo w-auto"
      value={atual.slug}
      onChange={(e) => router.push(`/mapa?e=${e.target.value}`)}
    >
      {empreendimentos.map((e) => (
        <option key={e.id} value={e.slug}>
          {e.nome}
        </option>
      ))}
    </select>
  );
}
