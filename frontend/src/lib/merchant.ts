type MerchantIdentity = { name?: string; code?: string };

export function merchantName(merchant?: MerchantIdentity): string | undefined {
  return merchant?.name?.trim() || ({ aliexpress: 'AliExpress', ebay: 'eBay' }[merchant?.code ?? '']);
}
