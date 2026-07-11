export interface QuoteLineInput {
  quantity: number;
  unitPrice: number;
  discountPct: number;
}

export interface QuoteTotals {
  subtotal: number;
  discountTotal: number;
  taxAmount: number;
  total: number;
}

/** Single source of truth for quote math (used by the action; mirrored in the builder UI). */
export function computeQuoteTotals(items: QuoteLineInput[], taxRatePct: number): QuoteTotals {
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const discountTotal = items.reduce(
    (s, i) => s + i.quantity * i.unitPrice * (i.discountPct / 100),
    0,
  );
  const taxable = subtotal - discountTotal;
  const taxAmount = taxable * (taxRatePct / 100);
  return {
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    taxAmount: round2(taxAmount),
    total: round2(taxable + taxAmount),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
