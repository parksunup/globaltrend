/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/": ["./data/legal/**/*", "./data/trends/**/*", "./data/derived/*.json"],
    "/team": ["./data/legal/**/*", "./data/trends/**/*", "./data/derived/*.json"],
    "/public": ["./data/legal/**/*", "./data/trends/**/*", "./data/derived/*.json"],
    "/public/laws": ["./data/legal/**/*", "./data/derived/*.json"],
    "/public/laws/*": ["./data/legal/**/*", "./data/derived/*.json"],
    "/public/search": ["./data/trends/**/*"],
    "/public/trends/*": ["./data/trends/**/*"],
    "/public/weekly": ["./data/trends/**/*"],
    "/public/sources": ["./data/trends/**/*"],
    "/work": ["./data/trends/**/*"],
    "/work/legal": ["./data/legal/**/*", "./data/derived/*.json"],
    "/feedback": ["./data/legal/**/*", "./data/trends/**/*", "./data/derived/*.json"],
    "/legal-translation": ["./data/legal/translations/**/*", "./data/derived/*.json"],
    "/legal-translation/*": ["./data/legal/translations/**/*", "./data/derived/*.json"]
  }
};
export default nextConfig;
