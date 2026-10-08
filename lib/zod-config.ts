import { z } from 'zod';

// The app's Content-Security-Policy (next.config.ts) allows no eval. Zod 4
// would otherwise probe for it with `new Function` on first use — one CSP
// violation report per page — before falling back to its interpreted path.
// Saying so up front skips the probe; validation behaves the same.
z.config({ jitless: true });
