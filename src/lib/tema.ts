/**
 * Claro, escuro ou o que o aparelho pedir.
 *
 * O tema é um atributo `data-tema` no `<html>` e um cookie de mesmo nome. O
 * cookie existe para o **servidor** já mandar a página pintada: com o tema
 * só no `localStorage`, toda navegação começaria branca e viraria escura
 * quando o JavaScript rodasse.
 *
 * `sistema` é o padrão e não é um terceiro visual — é "não escolhi", e aí
 * quem decide é o `prefers-color-scheme` do aparelho. Ver "Tema escuro" em
 * `globals.css`, que é onde as cores moram.
 */

export type Tema = "claro" | "escuro" | "sistema";

export const COOKIE_TEMA = "tema";

export const TEMAS: Tema[] = ["sistema", "claro", "escuro"];

export const ROTULO_TEMA: Record<Tema, string> = {
  sistema: "Automático",
  claro: "Claro",
  escuro: "Escuro",
};

/** Um valor qualquer vindo do cookie vira um tema válido. */
export function lerTema(valor: string | undefined | null): Tema {
  return valor === "claro" || valor === "escuro" ? valor : "sistema";
}

/** O próximo da roda, para o botão de um clique só. */
export function proximoTema(atual: Tema): Tema {
  return TEMAS[(TEMAS.indexOf(atual) + 1) % TEMAS.length];
}
