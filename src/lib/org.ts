import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { prisma } from "./prisma";

/**
 * Resolves the current session to an organization context.
 * Every dashboard page / server action starts here — it guarantees
 * the caller is authenticated AND a member of the org, so all queries
 * downstream can safely filter by `org.id`.
 *
 * Cached per-request so layout + page can both call it cheaply.
 */
export const requireOrg = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  if (!session.user.orgId) redirect("/signup");

  const membership = await prisma.membership.findUnique({
    where: {
      userId_organizationId: {
        userId: session.user.id,
        organizationId: session.user.orgId,
      },
    },
    include: { organization: true, user: true },
  });
  if (!membership) redirect("/login");

  return {
    org: membership.organization,
    user: membership.user,
    role: membership.role,
  };
});
