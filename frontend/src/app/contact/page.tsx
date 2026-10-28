import type { Metadata } from 'next';
import { InformationPage } from '@/components/InformationPage';

export const metadata: Metadata = { title: 'Contact BYB — BYB', description: 'Public contact availability.' };
export default function Page() {
  return <InformationPage title="Contact BYB" intro="Public contact availability."><section><h2>Contact form coming soon</h2><p>A public contact channel is not available yet. There is currently no form to submit a message through BYB.</p></section><section><h2>Questions about a purchase?</h2><p>Contact the merchant through the website where you placed your order for help with payments, delivery, or returns. BYB does not process orders or provide merchant customer support.</p></section></InformationPage>;
}
