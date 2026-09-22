import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  experimental: {
    // Padrão do Next é 1 MB — print de mapa e foto de celular passam disso
    // fácil. 10 MB dá folga sobre o limite de 8 MB anunciado ao usuário em
    // `@/lib/uploads` (overhead do multipart não deve estourar o corpo).
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
