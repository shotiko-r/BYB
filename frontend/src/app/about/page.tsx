import type { Metadata } from 'next';
import { AboutInformation } from '@/components/InformationPages';

export const metadata: Metadata = { title: 'About BYB — BYB', description: 'Better purchase decisions start before you buy.' };
export default function Page() {
  return <AboutInformation />;
}
