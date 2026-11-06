import type { Metadata } from 'next';
import { HowItWorksInformation } from '@/components/InformationPages';

export const metadata: Metadata = { title: 'How BYB works — BYB', description: 'From discovery to a more informed choice.' };
export default function Page() {
  return <HowItWorksInformation />;
}
