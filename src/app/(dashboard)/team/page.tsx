import { format } from "date-fns";
import { Badge, Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { InvitePanel } from "@/features/team/components/invite-panel";

export const metadata = { title: "Team Members" };

const ROLE_META: Record<string, { label: string; tone: "accent" | "positive" | "neutral" }> = {
  OWNER: { label: "Owner", tone: "accent" },
  ADMIN: { label: "Admin", tone: "positive" },
  AGENT: { label: "Agent", tone: "neutral" },
};

export default async function TeamPage() {
  const { org, role } = await requireOrg();

  const [members, invites] = await Promise.all([
    prisma.membership.findMany({
      where: { organizationId: org.id },
      orderBy: { createdAt: "asc" },
      include: { user: true },
    }),
    prisma.invite.findMany({
      where: { organizationId: org.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <>
      <Topbar title="Team Members" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10 space-y-4">
        {role !== "AGENT" && (
          <InvitePanel
            invites={invites.map((i) => ({
              id: i.id,
              token: i.token,
              role: i.role,
              expiresAt: i.expiresAt.toISOString(),
            }))}
          />
        )}
        <Card className="max-w-[760px] overflow-hidden">
          {members.map((m) => {
            const meta = ROLE_META[m.role] ?? ROLE_META.AGENT;
            const initials = m.user.name
              .split(/\s+/)
              .map((p) => p[0])
              .slice(0, 2)
              .join("")
              .toUpperCase();
            return (
              <div
                key={m.id}
                className="flex items-center gap-3.5 px-4 py-3.5 border-b border-line last:border-0 hover:bg-row-hover"
              >
                <div className="w-9 h-9 rounded-full bg-[#E9E8F9] text-accent flex items-center justify-center font-semibold text-[13px]">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold">{m.user.name}</div>
                  <div className="text-[12px] text-ink-mid">{m.user.email}</div>
                </div>
                <span className="text-[11.5px] text-ink-soft hidden sm:block">
                  Joined {format(m.createdAt, "MMM d, yyyy")}
                </span>
                <Badge tone={meta.tone}>{meta.label}</Badge>
              </div>
            );
          })}
        </Card>
      </div>
    </>
  );
}
