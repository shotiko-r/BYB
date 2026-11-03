import type { Metadata } from 'next';
import { Instrument_Sans, Noto_Sans_Georgian } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const instrument = Instrument_Sans({ subsets: ['latin'], variable: '--font-instrument', display: 'swap' });
const georgian = Noto_Sans_Georgian({ subsets: ['georgian', 'latin'], variable: '--font-noto-georgian', display: 'swap' });

export const metadata: Metadata = {
  title: 'BYB — Before You Buy',
  description: 'Compare prices across merchants before you buy anything online. Search products, compare offers, save money.',
  keywords: ['price comparison', 'shopping', 'product search', 'best deals', 'online shopping'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html suppressHydrationWarning data-scroll-behavior="smooth" lang="en" className={`${instrument.variable} ${georgian.variable} antialiased`}>
      <head>
        <meta name="mitgo-verification" content="02af5948-e34c-407a-adfe-91be52ea16d5" />
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('byb-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})()` }} />
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className="min-h-screen flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}