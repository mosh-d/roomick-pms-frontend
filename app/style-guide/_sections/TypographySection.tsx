import { Text, type TextRole } from '@/components/ui/Text';

const ROLES: { role: TextRole; metrics: string }[] = [
  { role: 'title', metrics: '32/34' },
  { role: 'header', metrics: '18/20' },
  { role: 'subheader', metrics: '16/18' },
  { role: 'body', metrics: '14/16' },
  { role: 'accent', metrics: '14/16 (+ primary-text color)' },
  { role: 'small', metrics: '12/14' },
  { role: 'smallAccent', metrics: '12/14 (+ primary-text color)' },
  { role: 'tiny', metrics: '11/13' },
  { role: 'emphasis', metrics: '32/34, always bold' },
];

export function TypographySection() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-header font-bold text-secondary">Typography</h2>
      <p className="text-small text-secondary-light max-w-prose">
        9 roles from the brand spec&apos;s type scale, mapped onto 6 unique size/line-height tokens — see
        design-system/02-typography.md for the full mapping table.
      </p>
      <div className="flex flex-col gap-4">
        {ROLES.map(({ role, metrics }) => (
          <div key={role} className="flex items-baseline gap-4 border-b border-accent/20 pb-3">
            <span className="w-28 shrink-0 text-tiny text-secondary-light">
              {role} <br /> {metrics}
            </span>
            <div className="flex flex-col gap-1">
              <Text role={role} as="span">
                The quick brown fox
              </Text>
              {role !== 'emphasis' ? (
                <Text role={role} as="span" bold>
                  The quick brown fox
                </Text>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
