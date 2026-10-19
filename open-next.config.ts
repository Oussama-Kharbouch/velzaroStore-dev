// OpenNext configuration: adapts the Next.js build to Cloudflare Workers.
//
// No incremental cache: every page is rendered on demand (force-dynamic shop page,
// dynamic dashboard), so nothing has to be kept between requests.
import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({});
