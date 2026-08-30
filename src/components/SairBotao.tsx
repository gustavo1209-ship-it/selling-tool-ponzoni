"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SairBotao() {
  const router = useRouter();

  async function sair() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button onClick={sair} className="btn btn-fantasma" title="Sair">
      <LogOut size={15} />
      <span className="hidden sm:inline">Sair</span>
    </button>
  );
}
