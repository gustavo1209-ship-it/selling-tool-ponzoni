/**
 * Limite de tamanho por arquivo enviado (fotos de empreendimento, mapa de
 * localização, logo). Compartilhado entre a validação no cliente (feedback
 * na hora, sem round-trip) e a Server Action (defesa em profundidade) —
 * fica bem abaixo do `bodySizeLimit` de Server Actions em `next.config.ts`
 * pra nunca bater no 413 cru do Next, que não tem mensagem amigável.
 */
export const MAX_TAMANHO_UPLOAD_MB = 8;

/** `null` quando o arquivo está dentro do limite; senão, a mensagem pra mostrar. */
export function erroTamanhoArquivo(arquivo: File): string | null {
  const limiteBytes = MAX_TAMANHO_UPLOAD_MB * 1024 * 1024;
  if (arquivo.size <= limiteBytes) return null;
  const tamanhoMb = (arquivo.size / 1024 / 1024).toFixed(1);
  return `Arquivo de ${tamanhoMb} MB — o limite é ${MAX_TAMANHO_UPLOAD_MB} MB.`;
}
