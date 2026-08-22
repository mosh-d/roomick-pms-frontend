'use client';

import { useState, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * The QueryClient is created inside useState (not as a module-level
 * singleton) so each component instance gets its own — a module-level
 * client would be silently SHARED across every request on the server,
 * leaking one user's cached data into another's response. useState's
 * initializer only runs once per mount, so this is a real singleton on the
 * client (where it actually needs to persist across re-renders) without
 * being a cross-request singleton on the server (where it must not).
 */
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
