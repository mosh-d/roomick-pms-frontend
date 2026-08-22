import type { ElementType, ReactNode } from 'react';

/**
 * The 9 Figma type-scale roles, composed here in one place instead of
 * re-derived ad hoc at every call site — same reuse principle as
 * lib/deriveRoomStatus.ts, just for typography. Several roles share a
 * size/line-height token (see design-system/tokens.css) and differ only in
 * color/weight, which is exactly what this map encodes:
 *   Body/Accent share `text-body`; Accent adds the primary-text gold color.
 *   Small/Small Accent share `text-small`; Small Accent adds the same gold.
 *   Title/Emphasis share `text-title`; Emphasis is always bold.
 */
export type TextRole =
  | 'title'
  | 'header'
  | 'subheader'
  | 'body'
  | 'accent'
  | 'small'
  | 'smallAccent'
  | 'tiny'
  | 'emphasis';

const ROLE_CLASSES: Record<TextRole, string> = {
  title: 'text-title',
  header: 'text-header',
  subheader: 'text-subheader',
  body: 'text-body',
  accent: 'text-body text-primary-text',
  small: 'text-small',
  smallAccent: 'text-small text-primary-text',
  tiny: 'text-tiny',
  // Emphasis is reserved for the one hero metric on a screen (e.g.
  // today's occupancy %) — always bold, never available in regular weight.
  emphasis: 'text-title font-bold',
};

export function Text({
  role,
  as: Component = 'p',
  bold = false,
  className = '',
  children,
}: {
  role: TextRole;
  as?: ElementType;
  bold?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const weightClass = role === 'emphasis' ? '' : bold ? 'font-bold' : 'font-normal';
  return <Component className={`${ROLE_CLASSES[role]} ${weightClass} ${className}`}>{children}</Component>;
}
