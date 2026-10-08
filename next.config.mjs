/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/": ["./data/legal/**/*", "./data/trends/**/*"],
    "/team": ["./data/legal/**/*", "./data/trends/**/*"],
    "/legal-translation": ["./data/legal/translations/**/*"],
    "/legal-translation/*": ["./data/legal/translations/**/*"]
  }
};
export default nextConfig;
