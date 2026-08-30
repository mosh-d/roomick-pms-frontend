import type { ReactNode } from 'react';

/**
 * Every operations page in the reference (Roomick-UI.pdf pages 10-19, 33-35)
 * opens the same way: an icon beside a serif `text-title` H1, a subtitle
 * under it, then a full-width rule closing the header off from the content
 * below.
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
 *
 * Colour is the PRIMARY family, not secondary. A page header sits on the
 * page background, and pixel-sampling the reference gives `#291e00` for the
 * title and `#242000` for the subtitle — both `primary-dark` (#2e2400),
 * nowhere near `secondary` (#160029, violet). Secondary text belongs inside
 * `tone="secondary"` cards. See `design-system/01-color.md`
 * § "Which family on which surface".
 */
export function PageHeader({
  icon,
  title,
  subtitle,
  actions,
  roles,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  /** Optional right-aligned controls sitting on the title row (e.g. a primary action). */
  actions?: ReactNode;
  /** The architecture map's own persona pill (e.g. "Front Desk · Manager") — who this page is for, not an access-control mechanism (the page's own `@Roles` guard is what's actually enforced; see `roomick_rbac_gating_sufficiency` — this is informational only). */
  roles?: string;
}) {
  return (
    <div className="flex flex-col gap-4">
      {roles ? (
        <span className="self-start inline-flex items-center rounded-pill border border-primary/30 bg-primary-light/30 px-3 py-1 text-tiny font-semibold text-primary-dark">
          {roles}
        </span>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* The icon takes `primary-dark`, matching the title beside it —
                not the gold `primary-text`, which is the small-accent role
                (Section labels, VIP badges). A page icon belongs to the
                title lockup and reads wrong in a different color from the
                words it sits against. */}
            {icon ? (
              <span className="shrink-0 text-primary-dark" aria-hidden>
                {icon}
              </span>
            ) : null}
            <h1 className="font-display text-title font-bold text-primary-dark truncate">{title}</h1>
          </div>
          {subtitle ? <p className="text-body text-primary-dark/75">{subtitle}</p> : null}
        </div>
        {actions ? <div className="shrink-0 flex items-center gap-3">{actions}</div> : null}
      </div>
      <div className="h-px w-full bg-primary/30" />
    </div>
  );
}
