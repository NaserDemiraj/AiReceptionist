import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { AcceptInviteForm } from "@/features/team/components/accept-invite-form";

export const metadata: Metadata = { title: "Join a team" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invite = await prisma.invite.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });

  const valid = invite && !invite.usedAt && invite.expiresAt > new Date();

  if (!valid) {
    return (
      <div className="w-full max-w-[400px]">
        <div className="bg-card border border-line rounded-[14px] p-7 text-center">
          <h1 className="font-display text-[20px] font-semibold tracking-tight text-ink">
            Invite not valid
          </h1>
          <p className="text-[13.5px] text-ink-mid mt-2">
            This invite link has expired or was already used. Ask your team owner to send a new
            one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[420px]">
      <div className="bg-card border border-line rounded-[14px] p-7">
        <h1 className="font-display text-[22px] font-semibold tracking-tight text-ink">
          Join {invite.organization.name}
        </h1>
        <p className="text-[13.5px] text-ink-mid mt-1 mb-6">
          You&apos;ve been invited as{" "}
          <span className="font-semibold">{invite.role === "ADMIN" ? "an admin" : "an agent"}</span>
          . Create your account to get started.
        </p>
        <AcceptInviteForm token={token} />
      </div>
    </div>
  );
}
