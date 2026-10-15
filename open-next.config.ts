import { defineCloudflareConfig } from '@opennextjs/cloudflare';

/**
 * OpenNext's settings for Cloudflare Workers. No incremental cache: every
 * page is rendered per request for its own script nonce (see middleware.ts),
 * so there is nothing prerendered to keep.
 */
export default defineCloudflareConfig({});
