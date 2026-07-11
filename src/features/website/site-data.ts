import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Loads a public site by org slug.
 * Unpublished sites are visible only to logged-in members of that org
 * (so the owner can preview before publishing).
 */
export async function getSite(slug: string) {
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: { site: true, aiConfig: true },
  });
  if (!org || !org.site) notFound();

  if (!org.site.published) {
    const session = await auth();
    if (!session?.user?.orgId || session.user.orgId !== org.id) notFound();
  }

  return { org, site: org.site };
}

export interface SiteService {
  title: string;
  description: string;
}

export function parseServices(raw: unknown): SiteService[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (s): s is SiteService =>
        !!s && typeof s === "object" && typeof (s as SiteService).title === "string",
    )
    .slice(0, 8);
}
