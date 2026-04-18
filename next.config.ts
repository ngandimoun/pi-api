import type { NextConfig } from "next";

function supabaseImageHostname(): string | null {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!u) return null;
  try {
    return new URL(u).hostname;
  } catch {
    return null;
  }
}

const supabaseHost = supabaseImageHostname();

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "pg-connection-string"],
  outputFileTracingExcludes: {
    "/api/cli/**": [
      "**/node_modules/ts-morph/**",
      "**/node_modules/@ts-morph/**",
      "**/node_modules/typescript/**",
      "**/node_modules/sharp/**",
      "**/node_modules/satori/**",
      "**/node_modules/livekit-server-sdk/**",
      "**/node_modules/livekit-client/**",
      "**/node_modules/@mastra/memory/**",
      "**/node_modules/@google/generative-ai/**",
    ],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh4.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh5.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "lh6.googleusercontent.com", pathname: "/**" },
      { protocol: "https", hostname: "avatars.githubusercontent.com", pathname: "/**" },
      ...(supabaseHost
        ? [{ protocol: "https" as const, hostname: supabaseHost, pathname: "/**" }]
        : []),
    ],
  },
};

export default nextConfig;
