// The parallax landing prototype grew up and became the real homepage
// (app/page.tsx, 2026-07-17). This route survives only as a redirect so
// old links and muscle memory keep working.
import { redirect } from 'next/navigation';

export default function PreviewPage() {
  redirect('/');
}
