import type { CatalogItem, ItemSelection } from './types';
import type { QuoteLine } from './pricing';

export function staffLines(items: CatalogItem[], selections: Record<string, ItemSelection>): QuoteLine[] {
  return items.map(item => {
    const selection = selections[item.id] ?? { selected: item.pricingMode === 'included', qty: item.defaultQty, unitPrice: item.price };
    const effectiveQty = Math.max(0, Number(selection.qty) || 0);
    const effectiveUnitPrice = Math.max(0, Number(item.price) || 0);
    const included = selection.selected;
    const amount = included && item.pricingMode !== 'included' && item.pricingMode !== 'reference' ? effectiveQty * effectiveUnitPrice : 0;
    return { item, selection, automatic: false, included, effectiveQty, effectiveUnitPrice, amount };
  });
}
