"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { forbidden, notFound } from "@/lib/errors";
import { computeQuoteTotals } from "./totals";

export type QuoteFormState = { error?: string } | undefined;

const itemSchema = z.object({
  productId: z.string().optional(),
  name: z.string().min(1).max(140),
  quantity: z.number().int().min(1).max(999),
  unitPrice: z.number().min(0),
  discountPct: z.number().min(0).max(100),
});

const quoteSchema = z.object({
  customerId: z.string().min(1, "Pick a customer"),
  leadId: z.string().optional(),
  taxRate: z.coerce.number().min(0).max(50),
  validDays: z.coerce.number().int().min(1).max(90),
  notes: z.string().max(1000),
  items: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid items" });
        return z.NEVER;
      }
    })
    .pipe(z.array(itemSchema).min(1, "Add at least one line item").max(30)),
});

export async function createQuote(
  _prev: QuoteFormState,
  formData: FormData,
): Promise<QuoteFormState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can create quotes");

  const parsed = quoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const customer = await prisma.customer.findFirst({
    where: { id: d.customerId, organizationId: org.id },
    select: { id: true },
  });
  if (!customer) return { error: "Customer not found" };

  const { subtotal, discountTotal, taxAmount, total } = computeQuoteTotals(d.items, d.taxRate);

  const year = new Date().getFullYear();
  const count = await prisma.quote.count({ where: { organizationId: org.id } });

  // Retry on the (rare) number collision from concurrent creates
  let quoteId: string | null = null;
  for (let attempt = 0; attempt < 3 && !quoteId; attempt++) {
    const number = `Q-${year}-${String(count + 1 + attempt).padStart(4, "0")}`;
    try {
      const quote = await prisma.quote.create({
        data: {
          organizationId: org.id,
          customerId: d.customerId,
          leadId: d.leadId || null,
          createdById: user.id,
          number,
          currency: org.currency,
          items: d.items,
          subtotal,
          discountTotal,
          taxRate: d.taxRate,
          taxAmount,
          total,
          notes: d.notes.trim() || null,
          validUntil: new Date(Date.now() + d.validDays * 24 * 3600_000),
        },
      });
      quoteId = quote.id;
    } catch {
      /* unique(number) collision — try next number */
    }
  }
  if (!quoteId) return { error: "Could not allocate a quote number — try again." };

  await prisma.auditLog.create({
    data: {
      organizationId: org.id,
      userId: user.id,
      action: "quote.create",
      entityType: "Quote",
      entityId: quoteId,
    },
  });

  revalidatePath("/quotes");
  redirect("/quotes");
}

export type EmailQuoteState = { error?: string; sent?: boolean } | undefined;

export async function emailQuote(
  _prev: EmailQuoteState,
  formData: FormData,
): Promise<EmailQuoteState> {
  const { org, user } = await requireOrg();
  const id = z.string().min(1).parse(formData.get("quoteId"));

  const quote = await prisma.quote.findFirst({
    where: { id, organizationId: org.id },
    include: { customer: true },
  });
  if (!quote) return { error: "Quote not found" };
  if (!quote.customer.email) {
    return { error: "This customer has no email address on file." };
  }

  const { renderQuotePdf } = await import("./pdf");
  const { sendEmail, emailLayout } = await import("@/lib/email");
  const pdfBytes = await renderQuotePdf(quote, org, quote.customer);

  const result = await sendEmail({
    to: quote.customer.email,
    subject: `Your quotation ${quote.number} from ${org.name}`,
    html: emailLayout(
      org.name,
      `<p>Hi ${quote.customer.name ?? "there"},</p>
       <p>Thank you for your interest! Your quotation <strong>${quote.number}</strong> is attached as a PDF.</p>
       ${quote.validUntil ? `<p>It is valid until <strong>${quote.validUntil.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</strong>.</p>` : ""}
       <p>Reply to this email or message us any time — we're happy to help.</p>
       <p>— The ${org.name} team</p>`,
    ),
    attachments: [
      {
        filename: `${quote.number}.pdf`,
        content: Buffer.from(pdfBytes).toString("base64"),
      },
    ],
  });

  if (!result.ok) {
    return {
      error:
        result.error === "resend_403"
          ? "Resend sandbox can only deliver to your own email until a domain is verified."
          : "Sending failed — check the email configuration.",
    };
  }

  await prisma.$transaction([
    ...(quote.status === "DRAFT"
      ? [prisma.quote.update({ where: { id: quote.id }, data: { status: "SENT" } })]
      : []),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "quote.email",
        entityType: "Quote",
        entityId: quote.id,
        metadata: { to: quote.customer.email },
      },
    }),
  ]);

  revalidatePath("/quotes");
  return { sent: true };
}

const STATUSES = ["DRAFT", "SENT", "ACCEPTED", "DECLINED", "EXPIRED"] as const;

export async function setQuoteStatus(formData: FormData): Promise<void> {
  const { org } = await requireOrg();
  const id = z.string().min(1).parse(formData.get("quoteId"));
  const status = z.enum(STATUSES).parse(formData.get("status"));

  const quote = await prisma.quote.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true, leadId: true },
  });
  if (!quote) throw notFound("Quote not found");

  await prisma.quote.update({ where: { id: quote.id }, data: { status } });

  // Accepted quote = won lead
  if (status === "ACCEPTED" && quote.leadId) {
    await prisma.lead.update({
      where: { id: quote.leadId },
      data: { status: "WON" },
    });
  }
  revalidatePath("/quotes");
}

export async function deleteQuote(formData: FormData): Promise<void> {
  const { org, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can delete quotes");
  const id = z.string().min(1).parse(formData.get("quoteId"));

  const quote = await prisma.quote.findFirst({
    where: { id, organizationId: org.id },
    select: { id: true },
  });
  if (!quote) throw notFound("Quote not found");

  await prisma.quote.delete({ where: { id: quote.id } });
  revalidatePath("/quotes");
}
