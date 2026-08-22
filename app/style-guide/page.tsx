import { Container } from '@/components/ui/Container';
import { ColorSection } from './_sections/ColorSection';
import { TypographySection } from './_sections/TypographySection';
import { ButtonsSection } from './_sections/ButtonsSection';
import { CardsSection } from './_sections/CardsSection';
import { StatusTagsSection } from './_sections/StatusTagsSection';
import { FormsSection } from './_sections/FormsSection';

// The primary verification vehicle for the design system — no real app
// pages exist yet, so this is where every token/component/state is
// checked live against the reference images (see the plan's §7
// Verification steps). `_sections/` is a private folder (underscore
// prefix), excluded from routing by Next.js's own convention.
export default function StyleGuidePage() {
  return (
    <Container className="py-12 flex flex-col gap-16">
      <div>
        <h1 className="text-title font-bold text-secondary">Roomick style guide</h1>
        <p className="text-body text-secondary-light mt-2 max-w-prose">
          Live reference for design-system/ — every token, component, and state rendered for visual verification.
        </p>
      </div>
      <ColorSection />
      <TypographySection />
      <ButtonsSection />
      <CardsSection />
      <StatusTagsSection />
      <FormsSection />
    </Container>
  );
}
