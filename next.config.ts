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
