import { describe, expect, it } from "vitest";
import { computeQuoteTotals } from "./totals";

describe("computeQuoteTotals", () => {
  it("computes the documented example correctly", () => {
    // 1× Oslo @ 899 with 5% + 2× Elva @ 289 no discount, 20% tax
    const totals = computeQuoteTotals(
      [
        { quantity: 1, unitPrice: 899, discountPct: 5 },
        { quantity: 2, unitPrice: 289, discountPct: 0 },
      ],
      20,
    );
    expect(totals.subtotal).toBe(1477);
    expect(totals.discountTotal).toBe(44.95);
    expect(totals.taxAmount).toBe(286.41);
    expect(totals.total).toBe(1718.46);
  });

  it("handles zero tax and zero discount", () => {
    const totals = computeQuoteTotals([{ quantity: 3, unitPrice: 100, discountPct: 0 }], 0);
    expect(totals).toEqual({ subtotal: 300, discountTotal: 0, taxAmount: 0, total: 300 });
  });

  it("handles a 100% discount line", () => {
    const totals = computeQuoteTotals([{ quantity: 1, unitPrice: 50, discountPct: 100 }], 20);
    expect(totals.total).toBe(0);
  });

  it("rounds to cents", () => {
    const totals = computeQuoteTotals([{ quantity: 3, unitPrice: 33.33, discountPct: 10 }], 17);
    expect(Number.isInteger(totals.total * 100)).toBe(true);
  });
});
