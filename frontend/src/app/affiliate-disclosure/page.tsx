import type { Metadata } from 'next';
import { InformationPage } from '@/components/InformationPage';

export const metadata: Metadata = { title: 'Affiliate disclosure — BYB', description: 'A clear view of how merchant links may support BYB.' };
export default function Page() {
  return <InformationPage title="Affiliate disclosure" intro="A clear view of how merchant links may support BYB."><section><h2>Commission from qualifying purchases</h2><p>BYB may earn a commission when you follow a merchant link and make a qualifying purchase. These commissions do not change your purchase price.</p></section><section><h2>The merchant controls the offer</h2><p>Availability, prices, shipping, and purchase terms remain controlled by the merchant. Confirm the final details on the merchant’s website before paying.</p></section><section><h2>Make your own comparison</h2><p>BYB helps you discover and compare offers. We do not promise that every merchant or offer is included, or that the first result is the lowest price.</p></section></InformationPage>;
}
