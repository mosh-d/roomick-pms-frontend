'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { LockIcon } from '@/components/ui/Icons';
import { firstOpenHref, pathOpens, type CanOpen } from '@/lib/navigation';
import { useMyPagesQuery } from '@/lib/pageAccess';
import { useAuthStore } from '@/lib/store/authStore';

interface PageAccessValue {
  /** False until the person's pages at this branch are known. */
  ready: boolean;
  canOpen: CanOpen;
  /** The page list couldn't be read — nothing opens until it can be. */
  failed?: boolean;
  retry?: () => void;
}

const OPEN_TO_ALL: PageAccessValue = { ready: true, canOpen: () => true };

// Anything rendered outside the dashboard shell (or before it) sees every page — the server still decides what loads.
const PageAccessContext = createContext<PageAccessValue>(OPEN_TO_ALL);

/**
 * Which pages the signed-in person opens at the active branch — every page
 * for an owner or the branch's manager, otherwise the pages their branch
 * manager gave their role (Staff Management → Page Access). The sidebar,
 * breadcrumbs, hub cards and `PageGate` all read it.
 *
 * If the answer can't be fetched, nothing is hidden: the server still
 * refuses what a restricted role may not reach, so failing open costs a
 * page that won't load, never data.
 */
export function PageAccessProvider({ branchId, children }: { branchId: string; children: ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const query = useMyPagesQuery(branchId, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });
  const data = query.data;
  const loading = query.isLoading;

  const failed = query.isError;
  const refetch = query.refetch;
  const value = useMemo<PageAccessValue>(() => {
    if (loading) return { ready: false, canOpen: () => false };
    // Closed, not open, when the list can't be read: the server refuses the
    // API calls anyway, so an open page would only be a page of errors.
    if (failed) return { ready: true, canOpen: () => false, failed: true, retry: () => void refetch() };
    if (!data || !data.restricted) return OPEN_TO_ALL;
    const allowed = new Set(data.pages);
    return { ready: true, canOpen: (href) => allowed.has(href) };
  }, [loading, failed, refetch, data]);

  return <PageAccessContext.Provider value={value}>{children}</PageAccessContext.Provider>;
}

export function usePageAccess(): PageAccessValue {
  return useContext(PageAccessContext);
}

/**
 * Shows the page only if the person may open it. A page they can't open says
 * so (with the way to one they can); the dashboard's front page, for someone
 * who has no Front Desk pages, goes straight to their first page instead.
 */
export function PageGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, canOpen, failed, retry } = usePageAccess();
  const opens = ready && pathOpens(pathname, canOpen);
  const fallback = ready ? firstOpenHref(canOpen) : null;
  const redirect = ready && !opens && !failed && pathname === '/dashboard' && fallback !== null ? fallback : null;

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (!ready || redirect) return null;
  if (failed) return <AccessCheckFailed retry={retry} />;
  if (!opens) return <NoAccess fallback={fallback} />;
  return children;
}

function AccessCheckFailed({ retry }: { retry?: () => void }) {
  return (
    <Container className="max-w-3xl py-10">
      <Card tone="primary" className="flex flex-col gap-3" id="page-access-unavailable">
        <p className="text-header font-bold text-surface">Couldn’t check which pages are open to you</p>
        <p className="text-body text-surface">The server didn’t answer. Check the connection and try again — nothing opens until it does.</p>
        {retry ? (
          <button type="button" onClick={retry} className="self-start text-body font-semibold text-surface underline cursor-pointer">
            Try again
          </button>
        ) : null}
      </Card>
    </Container>
  );
}

function NoAccess({ fallback }: { fallback: string | null }) {
  return (
    <Container className="max-w-3xl py-10">
      <Card tone="primary" className="flex flex-col gap-3" id="no-page-access">
        <div className="flex items-center gap-2">
          <LockIcon className="size-5" />
          <p className="text-header font-bold text-surface">This page isn’t open to you</p>
        </div>
        <p className="text-body text-surface">
          Your branch manager decides which pages your role opens here, on Staff Management → Page Access. Ask them if you need this one.
        </p>
        {fallback ? (
          <Link href={fallback} className="self-start text-body font-semibold text-surface underline">
            Go to your pages
          </Link>
        ) : (
          <p className="text-body text-surface-muted">Your role has no pages at this branch yet.</p>
        )}
      </Card>
    </Container>
  );
}
