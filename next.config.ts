import type { NextConfig } from "next";
import { networkInterfaces } from "node:os";
import { ADMIN_PATH } from "./lib/site";

/**
 * IPv4 addresses of this machine (Wi-Fi, Ethernet…), read at startup since they
 * change with each network. Without them, a phone opening http://<IP>:3000 sees
 * Next block its development resources. No effect in production.
 */
const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((net) => net?.family === "IPv4")
  .map((net) => net!.address);

/**
 * Image hosts: the R2 public address in use (R2_PUBLIC_URL, r2.dev for now) and the custom
 * domain that will replace it. The shop renders plain <img> tags today, so this only matters
 * if next/image is adopted later; addresses themselves are always built from R2_PUBLIC_URL.
 */
const r2Host = (() => {
  try { return new URL(process.env.R2_PUBLIC_URL ?? "").hostname; } catch { return ""; }
})();
const imageHosts = [...new Set([r2Host, "media.prestigea.shop"].filter(Boolean))];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: imageHosts.map((hostname) => ({ protocol: "https" as const, hostname, pathname: "/**" })),
  },
  // Also allow temporary Cloudflare quick tunnels (`cloudflared tunnel --url`) used to preview on a phone.
  allowedDevOrigins: [...lanAddresses, "*.trycloudflare.com"],
  // Strict Mode runs effects twice in development only; the saved language
  // (localStorage "vz-language") would then be reset to French on reload in dev.
  reactStrictMode: false,
  // Do not let `next dev` write AGENTS.md / CLAUDE.md into the project.
  agentRules: false,

  /*
   * Dashboard address (ADMIN_PATH, lib/site.ts): pages live in app/admin and are
   * served under ADMIN_PATH. The plain /admin address sends visitors home, so the
   * dashboard only answers at the chosen address. Redirects run before rewrites,
   * and a rewritten address is not redirected again: no loop.
   */
  async redirects() {
    if (ADMIN_PATH === "/admin") return [];
    return [
      { source: "/admin", destination: "/", permanent: false },
      { source: "/admin/:path*", destination: "/", permanent: false },
    ];
  },
  async rewrites() {
    if (ADMIN_PATH === "/admin") return [];
    return [
      { source: ADMIN_PATH, destination: "/admin" },
      { source: `${ADMIN_PATH}/:path*`, destination: "/admin/:path*" },
    ];
  },
};

export default nextConfig;
