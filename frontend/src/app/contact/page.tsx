import type { Metadata } from 'next';
import { ContactInformation } from '@/components/InformationPages';

export const metadata: Metadata = { title: 'Contact BYB — BYB', description: 'Public contact availability.' };
export default function Page() {
  return <ContactInformation />;
}
