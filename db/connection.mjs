// Shared by the Next.js server and the scripts in scripts/ (plain Node, no build step).

/**
 * pg treats sslmode=require as verify-full today and warns that this will change.
 * Ask for verify-full explicitly: same (secure) behaviour, no warning.
 * @param {string} url
 */
export function withVerifiedTls(url) {
  return url.replace(/([?&]sslmode=)(prefer|require|verify-ca)\b/, "$1verify-full");
}
