import { Button } from '@/components/ui/Button';

export function ButtonsSection() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-header font-bold text-secondary">Buttons</h2>
      <p className="text-small text-secondary-light max-w-prose">
        3 variants × default / hover (mouse over to check) / disabled, matching the reference image&apos;s 3×3
        grid.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="flex flex-col gap-2">
          <Button variant="primary">Primary</Button>
          <Button variant="primary" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="outline">Outline</Button>
          <Button variant="outline" disabled>
            Disabled
          </Button>
        </div>
        <div className="flex flex-col gap-2">
          <Button variant="secondary">Secondary</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
        </div>
      </div>
      <div className="flex gap-3 items-center">
        <Button variant="primary" size="sm">
          Small
        </Button>
        <Button variant="primary" loading>
          Loading
        </Button>
      </div>
    </section>
  );
}
