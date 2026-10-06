/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/": ["./data/legal/**/*", "./data/trends/**/*"],
    "/team": ["./data/legal/**/*", "./data/trends/**/*"]
  }
};
export default nextConfig;
