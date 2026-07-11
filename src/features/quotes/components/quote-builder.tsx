"use client";

import { useActionState, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { createQuote } from "../actions";
import { Button, Field, Input, Select } from "@/components/ui";
import type { QuoteItem } from "../pdf";

interface ProductOption {
  id: string;
  name: string;
  price: number;
  salePrice: number | null;
}

interface CustomerOption {
  id: string;
  label: string;
}

function money(n: number, currency: string) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(n);
}

export function QuoteBuilder({
  customers,
  products,
  currency,
  initialCustomerId,
  leadId,
  initialItems,
}: {
  customers: CustomerOption[];
  products: ProductOption[];
  currency: string;
  initialCustomerId?: string;
  leadId?: string;
  initialItems: QuoteItem[];
}) {
  const [state, formAction, pending] = useActionState(createQuote, undefined);
  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [taxRate, setTaxRate] = useState(0);

  const totals = useMemo(() => {
    const subtotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
    const discount = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.discountPct / 100), 0);
    const taxable = subtotal - discount;
    const tax = taxable * (taxRate / 100);
    return { subtotal, discount, tax, total: taxable + tax };
  }, [items, taxRate]);

  function addProduct(productId: string) {
    const p = products.find((x) => x.id === productId);
    if (!p) return;
    setItems((prev) => [
      ...prev,
      {
        productId: p.id,
        name: p.name,
        quantity: 1,
        unitPrice: p.salePrice ?? p.price,
        discountPct: 0,
      },
    ]);
  }

  function update(index: number, patch: Partial<QuoteItem>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  function remove(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <form action={formAction} className="space-y-5">
      {leadId && <input type="hidden" name="leadId" value={leadId} />}
      <input type="hidden" name="items" value={JSON.stringify(items)} />

      <Field label="Customer">
        <Select name="customerId" defaultValue={initialCustomerId ?? ""} required>
          <option value="" disabled>
            Choose a customer…
          </option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>

      {/* Line items */}
      <div>
        <div className="text-[13px] font-medium text-ink mb-1.5">Line items</div>
        <div className="border border-line rounded-[10px] overflow-hidden">
          {items.length === 0 ? (
            <p className="text-[12.5px] text-ink-soft text-center py-6">
              Add products below to build the quote.
            </p>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line bg-row-hover">
                  <th className="text-left font-mono text-[10px] uppercase tracking-wider text-ink-soft font-medium px-3 py-2">Item</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-ink-soft font-medium px-2 py-2 w-[70px]">Qty</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-ink-soft font-medium px-2 py-2 w-[110px]">Unit €</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-ink-soft font-medium px-2 py-2 w-[80px]">Disc %</th>
                  <th className="text-right font-mono text-[10px] uppercase tracking-wider text-ink-soft font-medium px-3 py-2 w-[110px]">Total</th>
                  <th className="w-[40px]"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    <td className="px-3 py-2 font-medium">{item.name}</td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(e) => update(i, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-full h-8 px-2 text-right bg-card border border-line rounded-lg text-[12.5px] outline-none focus:border-accent-line"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(e) => update(i, { unitPrice: Math.max(0, Number(e.target.value) || 0) })}
                        className="w-full h-8 px-2 text-right bg-card border border-line rounded-lg text-[12.5px] outline-none focus:border-accent-line"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={item.discountPct}
                        onChange={(e) =>
                          update(i, { discountPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })
                        }
                        className="w-full h-8 px-2 text-right bg-card border border-line rounded-lg text-[12.5px] outline-none focus:border-accent-line"
                      />
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-[12.5px] font-semibold">
                      {money(item.quantity * item.unitPrice * (1 - item.discountPct / 100), currency)}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="w-7 h-7 flex items-center justify-center rounded-md text-ink-soft hover:text-danger hover:bg-danger-soft cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2.5">
          <Select
            className="max-w-[320px]"
            value=""
            onChange={(e) => {
              if (e.target.value) addProduct(e.target.value);
            }}
          >
            <option value="">+ Add product from catalog…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {money(p.salePrice ?? p.price, currency)}
              </option>
            ))}
          </Select>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setItems((prev) => [...prev, { name: "Custom item", quantity: 1, unitPrice: 0, discountPct: 0 }])
            }
          >
            <Plus size={14} /> Custom line
          </Button>
        </div>
      </div>

      {/* Custom item names (only for lines without productId) */}
      {items.some((i) => !i.productId) && (
        <div className="space-y-2">
          {items.map((item, i) =>
            item.productId ? null : (
              <div key={i} className="flex items-center gap-2">
                <span className="text-[12px] text-ink-soft w-20 shrink-0">Line {i + 1} name</span>
                <Input value={item.name} onChange={(e) => update(i, { name: e.target.value })} />
              </div>
            ),
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <Field label="Tax rate (%)">
          <Input
            name="taxRate"
            type="number"
            min={0}
            max={50}
            value={taxRate}
            onChange={(e) => setTaxRate(Math.min(50, Math.max(0, Number(e.target.value) || 0)))}
          />
        </Field>
        <Field label="Valid for (days)">
          <Input name="validDays" type="number" min={1} max={90} defaultValue={14} />
        </Field>
      </div>

      <Field label="Notes (shown on the PDF)">
        <textarea
          name="notes"
          rows={2}
          placeholder="Delivery within 5 working days after confirmation. Free assembly included."
          className="w-full px-3.5 py-2.5 bg-card border border-line rounded-[10px] text-[13.5px] text-ink placeholder:text-ink-soft outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft transition resize-y"
        />
      </Field>

      {/* Totals */}
      <div className="bg-canvas border border-line rounded-[10px] px-4 py-3 max-w-[320px] ml-auto space-y-1.5">
        <div className="flex justify-between text-[12.5px] text-ink-mid">
          <span>Subtotal</span>
          <span className="font-mono">{money(totals.subtotal, currency)}</span>
        </div>
        {totals.discount > 0 && (
          <div className="flex justify-between text-[12.5px] text-ink-mid">
            <span>Discount</span>
            <span className="font-mono">-{money(totals.discount, currency)}</span>
          </div>
        )}
        {totals.tax > 0 && (
          <div className="flex justify-between text-[12.5px] text-ink-mid">
            <span>Tax ({taxRate}%)</span>
            <span className="font-mono">{money(totals.tax, currency)}</span>
          </div>
        )}
        <div className="flex justify-between text-[14px] font-semibold border-t border-line pt-1.5">
          <span>Total</span>
          <span className="font-mono">{money(totals.total, currency)}</span>
        </div>
      </div>

      {state?.error && (
        <p className="text-[12.5px] text-danger bg-danger-soft border border-danger/15 rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || items.length === 0}>
          {pending ? "Creating…" : "Create quote"}
        </Button>
      </div>
    </form>
  );
}
