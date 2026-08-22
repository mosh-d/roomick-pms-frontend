import type { ReactNode } from 'react';

const BASE_SWATCHES = [
  { name: 'Primary', className: 'bg-primary', hex: '#CCA000' },
  { name: 'Primary dark', className: 'bg-primary-dark', hex: '#2E2400' },
  { name: 'Primary light', className: 'bg-primary-light', hex: '#FFF0B9' },
  { name: 'Secondary', className: 'bg-secondary', hex: '#160029' },
  { name: 'Secondary light', className: 'bg-secondary-light', hex: '#A698B2' },
  { name: 'Accent', className: 'bg-accent', hex: '#A1ABB2' },
  { name: 'Accent dark', className: 'bg-accent-dark', hex: '#3B444A' },
  { name: 'White', className: 'bg-white border border-accent/30', hex: '#FFFFFF' },
  { name: 'Black', className: 'bg-black', hex: '#000000' },
];

const STATUS_SWATCHES = [
  { name: 'Vacant', className: 'bg-status-vacant' },
  { name: 'Occupied', className: 'bg-status-occupied' },
  { name: 'Cleaning', className: 'bg-status-cleaning' },
  { name: 'Out Of Order', className: 'bg-status-out-of-order' },
  { name: 'Blocked', className: 'bg-status-blocked' },
];

// Nesting demo: the same formula documented in design-system/01-color.md,
// computed here rather than hand-typed so this demo can never drift from
// the doc's math.
const NESTING_DEPTHS = [1, 2, 3, 4];
function effectiveTint(depth: number) {
  return (1 - Math.pow(0.9, depth)) * 100;
}

function Swatch({ name, className, hex }: { name: string; className: string; hex?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`h-16 rounded-card ${className}`} />
      <span className="text-small font-semibold text-secondary">{name}</span>
      {hex ? <span className="text-tiny text-secondary-light">{hex}</span> : null}
    </div>
  );
}

export function ColorSection() {
  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-header font-bold text-secondary">Color</h2>

      <div>
        <h3 className="text-subheader font-semibold text-secondary mb-3">Base palette</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
          {BASE_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-subheader font-semibold text-secondary mb-3">
          Accessibility extension — <code className="text-tiny">primary-text</code>
        </h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4 items-start">
          <Swatch name="primary-text" className="bg-primary-text" hex="#8C6D00" />
          <p className="col-span-2 sm:col-span-4 text-small text-secondary-light self-center">
            Raw <code>primary</code> gold measures ~2.45:1 on white (fails WCAG AA for text).{' '}
            <code>primary-text</code> measures ~4.9:1 — used for small gold text (Accent/Small Accent roles, VIP
            badge label) instead of raw <code>primary</code>.
          </p>
        </div>
      </div>

      <div>
        <h3 className="text-subheader font-semibold text-secondary mb-3">Status colors</h3>
        <div className="grid grid-cols-3 sm:grid-cols-5 gap-4">
          {STATUS_SWATCHES.map((swatch) => (
            <Swatch key={swatch.name} {...swatch} />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-subheader font-semibold text-secondary mb-3">
          Card-nesting opacity mechanic — <code className="text-tiny">1 − 0.9^N</code>
        </h3>
        <div className="flex flex-wrap gap-6 items-start">
          {(() => {
            function renderLevel(depth: number): ReactNode {
              if (depth > NESTING_DEPTHS.length) return null;
              // Matches Card.tsx's actual tone classes exactly (dark-variant
              // bases, text-secondary labels) rather than reimplementing
              // its own — see Card.tsx's TONE_CLASSES comment for why: a
              // lighter base color compounds toward a pastel that collides
              // with text-secondary-light at depth, which is exactly the
              // bug this demo used to (accidentally) illustrate.
              return (
                <div className="bg-secondary/10 border border-secondary/20 rounded-card p-4">
                  <span className="text-tiny text-secondary block mb-2">
                    depth {depth} — {effectiveTint(depth).toFixed(1)}%
                  </span>
                  {renderLevel(depth + 1)}
                </div>
              );
            }
            return renderLevel(1);
          })()}
          <div className="bg-primary-dark/10 border border-primary-dark/20 rounded-card p-4">
            <span className="text-tiny text-secondary block mb-2">mixed tone — primary-dark/10</span>
            <div className="bg-secondary/10 border border-secondary/20 rounded-card p-4">
              <span className="text-tiny text-secondary">secondary/10 nested inside</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
