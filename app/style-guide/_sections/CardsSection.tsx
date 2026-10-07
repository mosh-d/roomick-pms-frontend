import { Card, type CardTone } from '@/components/ui/Card';

const TONES: CardTone[] = ['primary', 'secondary', 'accent'];

export function CardsSection() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-header font-bold text-surface">Cards</h2>
      <div>
        <h3 className="text-subheader font-semibold text-surface mb-3">All tones</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {TONES.map((tone) => (
            <Card key={tone} tone={tone}>
              <span className="text-small font-semibold text-surface">tone=&quot;{tone}&quot;</span>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-subheader font-semibold text-surface mb-3">Nesting depth (no `level` prop)</h3>
        <Card tone="secondary">
          <span className="text-small text-surface block mb-2">depth 1</span>
          <Card tone="secondary">
            <span className="text-small text-surface block mb-2">depth 2</span>
            <Card tone="secondary">
              <span className="text-small text-surface">depth 3</span>
            </Card>
          </Card>
        </Card>
      </div>
    </section>
  );
}
