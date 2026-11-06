import type { Metadata } from 'next';
import { PartnersInformation } from '@/components/InformationPages';

export const metadata: Metadata = { title: 'Partner with BYB — BYB', description: 'Help shoppers discover and compare your offers.' };
export default function Page() {
  return <PartnersInformation />;
}
