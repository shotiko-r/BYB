import { z } from 'zod';
import { VariationGroupSchema, type VariationGroup } from '@byb/shared/types';
import { mapItem, readAspects } from './mapping.js';

const groupIdentity = z.object({ primaryItemGroup: z.object({
  itemGroupId: z.string().regex(/^[0-9]{1,30}$/),
  itemGroupType: z.literal('SELLER_DEFINED_VARIATIONS'),
}) });
export function itemGroupId(item: unknown): string | undefined {
  const parsed = groupIdentity.safeParse(item);
  return parsed.success ? parsed.data.primaryItemGroup.itemGroupId : undefined;
}

export function normalizeVariations(input: unknown, groupId: string, now = Date.now()): VariationGroup | undefined {
  const response = z.object({ items: z.array(z.unknown()).max(1000) }).safeParse(input);
  if (!response.success) return undefined;
  const members = response.data.items.slice(0, 100).flatMap(raw => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const item = raw as Record<string, unknown>;
    // A member must belong to the requested group; never combine unrelated listings.
    if (itemGroupId(raw) !== groupId) return [];
    const mapped = mapItem(raw, { detail: true });
    if (!mapped) return [];
    const aspects = readAspects(item.localizedAspects);
    const selections = Object.fromEntries(aspects.map(aspect => [aspect.name, aspect.value]));
    if (new Set(aspects.map(aspect => aspect.name)).size !== aspects.length) return [];
    const statuses = z.array(z.object({
      estimatedAvailabilityStatus: z.string().optional(),
      estimatedAvailableQuantity: z.number().nonnegative().optional(),
      estimatedRemainingQuantity: z.number().nonnegative().optional(),
    })).max(20).safeParse(item.estimatedAvailabilities);
    const stock = statuses.success ? statuses.data : [];
    const ended = typeof item.itemEndDate === 'string' && Date.parse(item.itemEndDate) <= now;
    const unavailable = ended || stock.some(entry => entry.estimatedAvailabilityStatus === 'OUT_OF_STOCK'
      || entry.estimatedAvailableQuantity === 0 || entry.estimatedRemainingQuantity === 0);
    const availability = unavailable ? 'out_of_stock' : stock.some(entry => entry.estimatedAvailabilityStatus === 'IN_STOCK')
      ? 'in_stock' : stock.some(entry => entry.estimatedAvailabilityStatus === 'LIMITED_STOCK') ? 'limited' : 'unknown';
    return [{ externalProductId: mapped.externalId, selections, priceAmount: mapped.priceAmount,
      currencyCode: mapped.currencyCode, images: (mapped.attributes?.images ?? []) as string[],
      availability, destinationUrl: mapped.destinationUrl, shippingInfo: mapped.shippingInfo ?? {} }];
  });
  const unique = members.filter((member, index) => members.findIndex(other => other.externalProductId === member.externalProductId) === index);
  if (unique.length < 2) return undefined;
  // Only aspects present on every valid member and actually varying are dimensions.
  const dimensions = Object.keys(unique[0]!.selections).flatMap(name => {
    if (!unique.every(member => Object.hasOwn(member.selections, name))) return [];
    const values = [...new Set(unique.map(member => member.selections[name]!))];
    return values.length > 1 ? [{ name, values }] : [];
  });
  if (!dimensions.length || dimensions.length > 8) return undefined;
  const variants = unique.map(member => ({ ...member,
    selections: Object.fromEntries(dimensions.map(dimension => [dimension.name, member.selections[dimension.name]!])),
  }));
  // Ambiguous combinations cannot safely choose a price or destination.
  if (new Set(variants.map(member => JSON.stringify(member.selections))).size !== variants.length) return undefined;
  const result = VariationGroupSchema.safeParse({ dimensions, variants });
  return result.success ? result.data : undefined;
}
