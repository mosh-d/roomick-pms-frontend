'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CheckIcon, ChevronUpDownIcon } from '@/components/ui/Icons';
import { branchSafeHref, breadcrumbTrail } from '@/lib/navigation';
import { useAuthStore } from '@/lib/store/authStore';

interface MenuOption {
  key: string;
  label: string;
  current: boolean;
  href?: string;
  onSelect?: () => void;
}

/**
 * Where you are, all the way up to the branch — "Sope Hotel Abijo /
 * Operations / Front Desk / Arrivals Dashboard" — with every level a way
 * back to it: each name is a link to that level, and a level with other
 * places beside it (the other branches, groups, features, or the other
 * pages of the same feature) carries the up-and-down chevrons that open
 * them, the way Cloudflare's dashboard does. Switching branch keeps you on
 * the same page where that makes sense (not on one folio or guest, which
 * belongs to the branch you left).
 *
 * Wide screens only: the trail runs long, so below `lg` the top bar keeps
 * just the logo, and the sidebar is the way around.
 */
export function Breadcrumbs({ branches }: { branches: Array<{ id: string; name: string }> }) {
  const pathname = usePathname();
  const router = useRouter();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const setActiveBranchId = useAuthStore((s) => s.setActiveBranchId);

  const branch = branches.find((b) => b.id === activeBranchId);
  const trail = breadcrumbTrail(pathname);

  const branchOptions: MenuOption[] = branches.map((b) => ({
    key: b.id,
    label: b.name,
    current: b.id === activeBranchId,
    onSelect: () => {
      if (b.id === activeBranchId) return;
      setActiveBranchId(b.id);
      router.push(branchSafeHref(pathname));
    },
  }));

  const levels = [
    ...(branch ? [{ key: 'branch', label: branch.name, href: '/dashboard', options: branchOptions, kind: 'branches' }] : []),
    ...trail.map((crumb, index) => ({
      key: `${index}-${crumb.label}`,
      label: crumb.label,
      href: crumb.href,
      kind: index === 0 && trail.length > 1 ? 'sections' : 'pages',
      options: crumb.options.map((option) => ({ key: option.href + option.label, label: option.label, href: option.href, current: option.label === crumb.label })),
    })),
  ];

  return (
    <nav aria-label="Breadcrumb" className="hidden lg:flex min-w-0">
      <ol className="flex items-center gap-2 min-w-0 text-small">
        {levels.map((level, index) => {
          const isCurrent = index === levels.length - 1;
          return (
            <Fragment key={level.key}>
              {index > 0 ? (
                <li aria-hidden className="text-accent shrink-0">
                  /
                </li>
              ) : null}
              <li className="flex items-center gap-1 min-w-0">
                {isCurrent || !level.href ? (
                  <span aria-current={isCurrent ? 'page' : undefined} className="truncate max-w-64 font-semibold text-primary-dark">
                    {level.label}
                  </span>
                ) : (
                  <Link href={level.href} className="truncate max-w-56 text-primary-text hover:underline underline-offset-2 cursor-pointer">
                    {level.label}
                  </Link>
                )}
                {level.options.length > 1 ? <CrumbMenu label={level.label} kind={level.kind} options={level.options} /> : null}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

/** One level's alternatives: the chevrons, and the list they open. Closes on a pick, a click elsewhere, Escape, or a page change. */
function CrumbMenu({ label, kind, options }: { label: string; kind: string; options: MenuOption[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // A page change closes it — compared during render rather than in an
  // effect, so there's no frame where the old menu hangs over the new page.
  if (open && openedAt !== pathname) {
    setOpen(false);
    setOpenedAt(pathname);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    // Into the list, on the page you're on (or the first), so the arrow keys work straight away.
    const items = listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    const current = listRef.current?.querySelector<HTMLElement>('[aria-current="true"]');
    (current ?? items?.[0])?.focus();
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  function close() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLUListElement>) {
    const items = Array.from(listRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = items.indexOf(document.activeElement as HTMLElement);
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      items[(index + 1) % items.length]?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      items[(index - 1 + items.length) % items.length]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      items[items.length - 1]?.focus();
    } else if (event.key === 'Tab') {
      setOpen(false);
    }
  }

  const itemClass = (current: boolean) =>
    `w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-small text-primary-dark hover:bg-primary-light/40 focus:bg-primary-light/40 focus:outline-none cursor-pointer ${
      current ? 'font-semibold' : ''
    }`;

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Other ${kind} — ${label}`}
        title={`Other ${kind}`}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((o) => !o);
        }}
        className="flex items-center rounded-control p-0.5 text-primary-dark/60 hover:text-primary-dark hover:bg-primary-light/40 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ChevronUpDownIcon className="size-3.5" />
      </button>
      {open ? (
        <ul
          ref={listRef}
          role="menu"
          aria-label={`Other ${kind}`}
          onKeyDown={onKeyDown}
          className="absolute left-0 top-full z-50 mt-2 min-w-56 max-h-80 overflow-y-auto rounded-card border border-primary/30 bg-white py-1 shadow-lg"
        >
          {options.map((option) => (
            <li key={option.key} role="none">
              {option.href ? (
                <Link
                  href={option.href}
                  role="menuitem"
                  aria-current={option.current ? 'true' : undefined}
                  onClick={() => setOpen(false)}
                  className={itemClass(option.current)}
                >
                  <span className="truncate">{option.label}</span>
                  {option.current ? <CheckIcon className="size-4 shrink-0" /> : null}
                </Link>
              ) : (
                <button
                  type="button"
                  role="menuitem"
                  aria-current={option.current ? 'true' : undefined}
                  onClick={() => {
                    setOpen(false);
                    option.onSelect?.();
                  }}
                  className={itemClass(option.current)}
                >
                  <span className="truncate">{option.label}</span>
                  {option.current ? <CheckIcon className="size-4 shrink-0" /> : null}
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
