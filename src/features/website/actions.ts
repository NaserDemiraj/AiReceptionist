"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { forbidden } from "@/lib/errors";
import { logger } from "@/lib/logger";

export type WebsiteFormState = { error?: string; success?: boolean } | undefined;

const serviceSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(300),
});

const websiteSchema = z.object({
  published: z.boolean(),
  heroTitle: z.string().max(120),
  heroSubtitle: z.string().max(300),
  aboutText: z.string().max(4000),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color"),
  seoTitle: z.string().max(70),
  seoDescription: z.string().max(170),
  googleMapsUrl: z.string().url().or(z.literal("")),
  showProducts: z.boolean(),
  showContactForm: z.boolean(),
  services: z
    .string()
    .transform((s, ctx) => {
      try {
        return JSON.parse(s) as unknown;
      } catch {
        ctx.addIssue({ code: "custom", message: "Invalid services" });
        return z.NEVER;
      }
    })
    .pipe(z.array(serviceSchema).max(8)),
});

export async function updateWebsite(
  _prev: WebsiteFormState,
  formData: FormData,
): Promise<WebsiteFormState> {
  const { org, user, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can edit the website");

  const parsed = websiteSchema.safeParse({
    published: formData.get("published") === "on",
    heroTitle: formData.get("heroTitle") ?? "",
    heroSubtitle: formData.get("heroSubtitle") ?? "",
    aboutText: formData.get("aboutText") ?? "",
    primaryColor: formData.get("primaryColor"),
    seoTitle: formData.get("seoTitle") ?? "",
    seoDescription: formData.get("seoDescription") ?? "",
    googleMapsUrl: (formData.get("googleMapsUrl") as string)?.trim() ?? "",
    showProducts: formData.get("showProducts") === "on",
    showContactForm: formData.get("showContactForm") === "on",
    services: formData.get("services") ?? "[]",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const data = {
    published: d.published,
    heroTitle: d.heroTitle.trim() || null,
    heroSubtitle: d.heroSubtitle.trim() || null,
    aboutText: d.aboutText.trim() || null,
    primaryColor: d.primaryColor,
    seoTitle: d.seoTitle.trim() || null,
    seoDescription: d.seoDescription.trim() || null,
    googleMapsUrl: d.googleMapsUrl || null,
    showProducts: d.showProducts,
    showContactForm: d.showContactForm,
    services: d.services,
  };

  await prisma.$transaction([
    prisma.website.upsert({
      where: { organizationId: org.id },
      create: { organizationId: org.id, ...data },
      update: data,
    }),
    prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: user.id,
        action: "website.update",
        entityType: "Website",
        metadata: { published: d.published },
      },
    }),
  ]);

  revalidatePath("/website");
  revalidatePath(`/site/${org.slug}`);
  return { success: true };
}

/* ---------- Public contact form ---------- */

const contactSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(2, "Please tell us your name").max(80),
  email: z.string().email("Enter a valid email").or(z.literal("")),
  phone: z.string().max(30),
  message: z.string().min(5, "Tell us a bit more").max(2000),
});

export type ContactFormState = { error?: string; success?: boolean } | undefined;

export async function submitContactForm(
  _prev: ContactFormState,
  formData: FormData,
): Promise<ContactFormState> {
  const parsed = contactSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  if (!d.email && !d.phone.trim()) {
    return { error: "Leave an email or phone number so we can reach you." };
  }

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0] ?? "local";
  const rateLimitResult = await rateLimit(`contact:${ip}`, 5, 10 * 60_000);
  if (!rateLimitResult.allowed) {
    return { error: "Too many messages — please try again later." };
  }

  const org = await prisma.organization.findUnique({
    where: { slug: d.slug },
    include: { site: true },
  });
  if (!org || !org.site?.published || !org.site.showContactForm) {
    return { error: "This form is not available." };
  }

  // Reuse an existing customer if the email/phone matches
  const existing = await prisma.customer.findFirst({
    where: {
      organizationId: org.id,
      OR: [
        ...(d.email ? [{ email: d.email }] : []),
        ...(d.phone.trim() ? [{ phone: d.phone.trim() }] : []),
      ],
    },
  });
  const customer =
    existing ??
    (await prisma.customer.create({
      data: {
        organizationId: org.id,
        name: d.name,
        email: d.email || null,
        phone: d.phone.trim() || null,
      },
    }));

  await prisma.$transaction([
    prisma.lead.create({
      data: {
        organizationId: org.id,
        customerId: customer.id,
        status: "NEW",
        interestedIn: d.message.slice(0, 200),
        notes: d.message,
        currency: org.currency,
      },
    }),
    prisma.notification.create({
      data: {
        organizationId: org.id,
        type: "SYSTEM",
        title: `Website inquiry from ${d.name}`,
        body: d.message.slice(0, 140),
      },
    }),
  ]);

  logger.info({ org: org.slug }, "website contact form lead");
  return { success: true };
}
