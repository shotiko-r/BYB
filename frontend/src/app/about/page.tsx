import type { Metadata } from 'next';
import { InformationPage } from '@/components/InformationPage';

export const metadata: Metadata = { title: 'About BYB — BYB', description: 'Better purchase decisions start before you buy.' };
export default function Page() {
  return <InformationPage title="About BYB" intro="Better purchase decisions start before you buy."><section><h2>Before You Buy</h2><p>BYB stands for Before You Buy. We are a product discovery and comparison platform that helps you explore products and compare merchant offers in one place.</p></section>
<section><h2>Compare here. Buy with the merchant.</h2><p>BYB is not a store. We do not sell products or process orders, payments, or returns. When you choose an offer, you leave BYB and complete your purchase on the merchant’s website.</p></section>
<section><h2>Starting with Georgia</h2><p>Our initial focus is Georgia. We plan to expand to Armenia and Azerbaijan, then broader markets. Our aim is simple: help you make better purchase decisions before buying.</p></section></InformationPage>;
}
