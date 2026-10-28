import type { Metadata } from 'next';
import { InformationLink as Link } from '@/components/InformationPage';
import { InformationPage } from '@/components/InformationPage';

export const metadata: Metadata = { title: 'Partner with BYB — BYB', description: 'Help shoppers discover and compare your offers.' };
export default function Page() {
  return <InformationPage title="Partner with BYB" intro="Help shoppers discover and compare your offers."><section><h2>For merchants, affiliate networks, and brands</h2><p>BYB helps users discover products and compare merchant offers. When a shopper chooses an available offer, we send traffic to the merchant’s website to complete the purchase.</p></section><section><h2>Connect your catalog</h2><p>BYB supports product-feed and API integrations for merchant offers. BYB does not fulfill orders or process payments or returns; the merchant owns the purchase experience.</p></section><section><h2>A regional starting point</h2><p>Our initial audience is focused on Georgia, with plans to expand into Armenia, Azerbaijan, and broader markets.</p></section><section><h2>Start a conversation</h2><p>Our public contact channel is not available yet. Visit the contact page for its current status.</p><Link className="btn-secondary" href="/contact">Contact BYB</Link></section></InformationPage>;
}
