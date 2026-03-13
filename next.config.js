/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Suprimir warnings de hidratação causados por extensões do navegador
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2
  },
  // Configuração para permitir importação de módulos externos
  experimental: {
    serverComponentsExternalPackages: ["swagger-ui-react"]
  },
  // Em Windows sem permissão de symlink, standalone pode falhar no build local.
  // Para deploy, habilite explicitamente com NEXT_OUTPUT_STANDALONE=true.
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined
}

module.exports = nextConfig
