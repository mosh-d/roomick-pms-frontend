import type { ReactNode } from 'react';

/**
 * Every operations page in the reference (Roomick-UI.pdf pages 10-19, 33-35)
 * opens the same way: an icon beside a serif `text-title` H1, a
 * `text-secondary-light` subtitle under it, then a full-width rule closing
 * the header off from the content below.
 *
 * Built as one component rather than repeated per page because the first
 * pass at these screens hand-rolled the header each time and every one of
 * them ended up missing the icon and the rule — a systemic drift caught in
 * a reference audit, not by inspection. Anything with a page title should
 * use this; nothing should re-implement it.
 *
 * `font-display` (Playfair) is applied here once — see
 * `design-system/02-typography.md`: the serif is opt-in and only ever at
 * `text-header` and above, which a page title always is.
 */
export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  /** Optional right-aligned controls sitting on the title row (e.g. a primary action). */
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            {icon ? (
              <span className="shrink-0 text-secondary" aria-hidden>
                {icon}
              </span>
            ) : null}
            <h1 className="font-display text-title font-bold text-secondary truncate">{title}</h1>
          </div>
          {subtitle ? <p className="text-body text-secondary-light">{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0 flex items-center gap-3">{actions}</div> : null}
      </div>
      <div className="h-px w-full bg-accent/30" />
    </div>
  );
}
