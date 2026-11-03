/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/podcast/extension": ["./extensions/notebooklm-bridge/*"],
    "/": ["./data/legal/**/*", "./data/trends/**/*", "./data/derived/*.json"],
    "/team": ["./data/legal/**/*", "./data/trends/**/*", "./data/derived/*.json"],
    "/public": ["./data/legal/**/*", "./data/trends/**/*", "./data/derived/*.json"],
    "/public/laws": ["./data/legal/**/*", "./data/derived/*.json"],
    "/public/laws/*": ["./data/legal/**/*", "./data/derived/*.json"],
    "/public/search": ["./data/trends/**/*"],
    "/public/trends/*": ["./data/trends/**/*"],
    "/public/weekly": ["./data/trends/**/*"],
    "/public/sources": ["./data/trends/**/*"],
    "/work": ["./data/legal/**/*", "./data/trends/**/*", "./data/derived/*.json"],
    "/work/new": ["./data/trends/**/*"],
    "/work/new/law": ["./data/legal/**/*", "./data/derived/*.json"],
    "/work/legal": ["./data/legal/**/*", "./data/derived/*.json"],
    "/feedback": ["./data/legal/**/*", "./data/trends/**/*", "./data/derived/*.json"],
    "/legal-translation": ["./data/legal/translations/**/*", "./data/derived/*.json"],
    "/legal-translation/*": ["./data/legal/translations/**/*", "./data/derived/*.json"]
  }
};
export default nextConfig;
