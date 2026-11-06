import type { Metadata } from 'next';
import { AffiliateDisclosureInformation } from '@/components/InformationPages';

export const metadata: Metadata = { title: 'Affiliate disclosure — BYB', description: 'A clear view of how merchant links may support BYB.' };
export default function Page() {
  return <AffiliateDisclosureInformation />;
}
