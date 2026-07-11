import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Customer, Organization, Quote } from "@prisma/client";
import { format } from "date-fns";

export interface QuoteItem {
  productId?: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
}

const INK = rgb(0.09, 0.09, 0.1);
const MID = rgb(0.42, 0.42, 0.46);
const SOFT = rgb(0.6, 0.6, 0.65);
const ACCENT = rgb(0.357, 0.341, 0.831); // #5B57D4
const LINE = rgb(0.918, 0.918, 0.925);

function money(n: number, currency: string): string {
  return `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

/** pdf-lib standard fonts use WinAnsi — replace anything outside it. */
function safe(text: string): string {
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\x00-\xFF€]/g, "?");
}

export async function renderQuotePdf(
  quote: Quote,
  org: Organization,
  customer: Customer,
): Promise<Uint8Array> {
  const items = quote.items as unknown as QuoteItem[];
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const helv = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const { width } = page.getSize();
  const margin = 50;
  let y = 790;

  const text = (
    str: string,
    x: number,
    yy: number,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; align?: "right"; page?: PDFPage } = {},
  ) => {
    const font = opts.font ?? helv;
    const size = opts.size ?? 10;
    const s = safe(str);
    const drawX = opts.align === "right" ? x - font.widthOfTextAtSize(s, size) : x;
    (opts.page ?? page).drawText(s, {
      x: drawX,
      y: yy,
      size,
      font,
      color: opts.color ?? INK,
    });
  };
  const hline = (yy: number, color = LINE, thickness = 1) =>
    page.drawLine({
      start: { x: margin, y: yy },
      end: { x: width - margin, y: yy },
      color,
      thickness,
    });

  /* ===== Header ===== */
  page.drawRectangle({ x: 0, y: 806, width, height: 36, color: ACCENT });
  text(org.name.toUpperCase(), margin, 818, { font: bold, size: 14, color: rgb(1, 1, 1) });
  text("QUOTATION", width - margin, 818, {
    font: bold,
    size: 14,
    color: rgb(1, 1, 1),
    align: "right",
  });

  y = 770;
  const orgLines = [org.address, org.phone, org.email, org.website].filter(Boolean) as string[];
  for (const line of orgLines) {
    text(line, margin, y, { size: 9, color: MID });
    y -= 13;
  }

  let ry = 770;
  text(`Quote no: ${quote.number}`, width - margin, ry, { font: bold, size: 10, align: "right" });
  ry -= 14;
  text(`Date: ${format(quote.createdAt, "dd MMM yyyy")}`, width - margin, ry, {
    size: 9,
    color: MID,
    align: "right",
  });
  ry -= 13;
  if (quote.validUntil) {
    text(`Valid until: ${format(quote.validUntil, "dd MMM yyyy")}`, width - margin, ry, {
      size: 9,
      color: MID,
      align: "right",
    });
    ry -= 13;
  }

  /* ===== Customer ===== */
  y = Math.min(y, ry) - 24;
  text("PREPARED FOR", margin, y, { size: 8, color: SOFT, font: bold });
  y -= 15;
  text(customer.name ?? "Customer", margin, y, { font: bold, size: 11 });
  y -= 14;
  const custLines = [customer.phone, customer.email].filter(Boolean) as string[];
  for (const line of custLines) {
    text(line, margin, y, { size: 9, color: MID });
    y -= 13;
  }

  /* ===== Items table ===== */
  y -= 18;
  const colQty = width - margin - 245;
  const colUnit = width - margin - 175;
  const colDisc = width - margin - 95;
  const colTotal = width - margin;

  text("ITEM", margin, y, { size: 8, color: SOFT, font: bold });
  text("QTY", colQty, y, { size: 8, color: SOFT, font: bold, align: "right" });
  text("UNIT PRICE", colUnit, y, { size: 8, color: SOFT, font: bold, align: "right" });
  text("DISCOUNT", colDisc, y, { size: 8, color: SOFT, font: bold, align: "right" });
  text("TOTAL", colTotal, y, { size: 8, color: SOFT, font: bold, align: "right" });
  y -= 8;
  hline(y, INK, 1.2);
  y -= 18;

  for (const item of items) {
    const lineTotal = item.quantity * item.unitPrice * (1 - item.discountPct / 100);
    text(item.name, margin, y, { size: 10 });
    text(String(item.quantity), colQty, y, { size: 10, align: "right" });
    text(money(item.unitPrice, quote.currency), colUnit, y, { size: 10, align: "right" });
    text(item.discountPct ? `${item.discountPct}%` : "-", colDisc, y, {
      size: 10,
      color: item.discountPct ? INK : SOFT,
      align: "right",
    });
    text(money(lineTotal, quote.currency), colTotal, y, { size: 10, font: bold, align: "right" });
    y -= 10;
    hline(y);
    y -= 16;
  }

  /* ===== Totals ===== */
  y -= 6;
  const totalsX = width - margin - 200;
  const row = (label: string, value: string, opts: { bold?: boolean; big?: boolean } = {}) => {
    text(label, totalsX, y, {
      size: opts.big ? 11 : 9.5,
      color: opts.bold ? INK : MID,
      font: opts.bold ? bold : helv,
    });
    text(value, colTotal, y, {
      size: opts.big ? 12 : 9.5,
      font: opts.bold ? bold : helv,
      align: "right",
    });
    y -= opts.big ? 22 : 16;
  };

  row("Subtotal", money(Number(quote.subtotal), quote.currency));
  if (Number(quote.discountTotal) > 0) {
    row("Discount", `-${money(Number(quote.discountTotal), quote.currency)}`);
  }
  if (quote.taxRate > 0) {
    row(`Tax (${quote.taxRate}%)`, money(Number(quote.taxAmount), quote.currency));
  }
  y -= 4;
  page.drawLine({
    start: { x: totalsX, y: y + 12 },
    end: { x: colTotal, y: y + 12 },
    color: INK,
    thickness: 1.2,
  });
  row("Total", money(Number(quote.total), quote.currency), { bold: true, big: true });

  /* ===== Notes ===== */
  if (quote.notes) {
    y -= 14;
    text("NOTES", margin, y, { size: 8, color: SOFT, font: bold });
    y -= 14;
    // naive word wrap at ~95 chars
    const words = quote.notes.split(/\s+/);
    let line = "";
    for (const w of words) {
      if ((line + " " + w).length > 95) {
        text(line, margin, y, { size: 9, color: MID });
        y -= 13;
        line = w;
      } else {
        line = line ? line + " " + w : w;
      }
    }
    if (line) {
      text(line, margin, y, { size: 9, color: MID });
      y -= 13;
    }
  }

  /* ===== Footer ===== */
  hline(60);
  text(`${org.name} · generated by AI Receptionist`, margin, 45, { size: 8, color: SOFT });
  text(format(new Date(), "dd MMM yyyy, HH:mm"), width - margin, 45, {
    size: 8,
    color: SOFT,
    align: "right",
  });

  return doc.save();
}
