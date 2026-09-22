import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  experimental: {
    // Padrão do Next é 1 MB — print de mapa e foto de celular passam disso fácil.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

export default nextConfig;
