import type { Metadata } from 'next';
import { InformationLink as Link } from '@/components/InformationPage';
import { InformationPage } from '@/components/InformationPage';

export const metadata: Metadata = { title: 'How BYB works — BYB', description: 'From discovery to a more informed choice.' };
export default function Page() {
  return <InformationPage title="How BYB works" intro="From discovery to a more informed choice."><ol className="information-steps"><li><h2>Search or browse</h2><p>Search for a product or start with a curated category.</p></li><li><h2>Compare products and offers</h2><p>Explore available products and the merchant offers shown for each.</p></li><li><h2>Check the details</h2><p>Review price, condition, shipping, estimated arrival, and specifications where available. Confirm missing details with the merchant.</p></li><li><h2>Choose a merchant</h2><p>Open an available merchant link when you find an offer that suits you.</p></li><li><h2>Buy on the merchant’s website</h2><p>Complete checkout with the merchant. Their terms, shipping policies, and return rules apply.</p></li></ol><section><h2>Before you checkout</h2><p>BYB does not sell the product or handle payments, orders, or returns. Prices and availability may change; confirm the final details on the merchant’s website.</p><p>BYB may receive an affiliate commission from qualifying purchases. <Link href="/affiliate-disclosure">Read our affiliate disclosure</Link>.</p></section></InformationPage>;
}
