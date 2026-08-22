import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Button } from '@/components/ui/Button';

// No real dashboard exists yet — this phase built the design system and
// component library only (see the plan under C:\Users\WINDOWS\.claude\plans\
// or design-system/ itself). /style-guide is where all of it is verifiable
// live; real app pages (auth, dashboard, room grid) are next phase.
export default function Home() {
  return (
    <Container className="py-16 flex flex-col items-start gap-4">
      <h1 className="text-title font-bold text-secondary">Roomick PMS</h1>
      <p className="text-body text-secondary-light max-w-prose">
        Frontend scaffold and design system are live. Real application pages haven&apos;t been built yet.
      </p>
      <Link href="/style-guide">
        <Button>View style guide</Button>
      </Link>
    </Container>
  );
}
