/**
 * O menu do topo, numa lista só — `Cabecalho.tsx` usa pra desenhar os links
 * e `ConfiguracoesForm.tsx` usa pra oferecer o que dá pra esconder. Início e
 * Admin ficam de fora: Início é a home e não faz sentido esconder; Admin já
 * é gated por papel (`soAdmin`), não por preferência de organização.
 */
export const ITENS_MENU_OPCIONAIS = [
  { href: "/mapa", rotulo: "Mapa" },
  { href: "/espelho", rotulo: "Espelho" },
  { href: "/funil", rotulo: "Funil" },
  { href: "/propostas", rotulo: "Propostas" },
  { href: "/contratos", rotulo: "Contratos" },
  { href: "/cobranca", rotulo: "A receber" },
  { href: "/clientes", rotulo: "Clientes" },
  { href: "/indices", rotulo: "Índices" },
] as const;
