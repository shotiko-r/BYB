export type EbayConfig = { environment: 'production' | 'sandbox'; clientId: string; clientSecret: string };
export const EBAY_URLS = {
  production: { oauth: 'https://api.ebay.com/identity/v1/oauth2/token', browse: 'https://api.ebay.com/buy/browse/v1' },
  sandbox: { oauth: 'https://api.sandbox.ebay.com/identity/v1/oauth2/token', browse: 'https://api.sandbox.ebay.com/buy/browse/v1' },
} as const;
// BYB destination market and eBay catalog marketplace are distinct. No delivery claim.
export const MARKETPLACES: Readonly<Record<string, 'EBAY_US'>> = {
  GE: 'EBAY_US', AM: 'EBAY_US', AZ: 'EBAY_US', US: 'EBAY_US',
  CA: 'EBAY_US', UK: 'EBAY_US', DE: 'EBAY_US', FR: 'EBAY_US',
};
