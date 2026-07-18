// The Wish Map merged into the Wish Gallery (galaxy/river views live at
// /wishes now). This route survives only as a redirect.
import { redirect } from 'next/navigation';

export default function OverviewPage() {
  redirect('/wishes');
}
