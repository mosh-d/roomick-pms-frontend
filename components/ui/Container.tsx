import type { ReactNode } from 'react';

/**
 * Roomick's max-width is wider than a typical marketing-site container
 * (Daddy Bear uses max-w-6xl / ~72rem) because room grids and data tables
 * need the horizontal room a reading-width column doesn't give them — see
 * design-system/03-spacing-layout.md.
 */
export function Container({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}
