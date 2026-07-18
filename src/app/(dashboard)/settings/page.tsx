import { Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/base-url";
import { OrgProfileForm } from "@/features/settings/components/org-profile-form";
import { WidgetSettingsForm } from "@/features/settings/components/widget-settings-form";
import { RotateKeyButton } from "@/features/settings/components/rotate-key-button";
import { ChangePasswordForm } from "@/features/settings/components/change-password-form";
import { TwoFactorCard } from "@/features/settings/components/two-factor-card";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { org, user } = await requireOrg();
  const baseUrl = await getBaseUrl();
  const config =
    (await prisma.aiConfig.findUnique({ where: { organizationId: org.id } })) ??
    (await prisma.aiConfig.create({ data: { organizationId: org.id } }));

  return (
    <>
      <Topbar title="Settings" />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <div className="max-w-[640px] space-y-4">
          <Card className="p-6">
            <h2 className="text-[15px] font-semibold mb-1">Business profile</h2>
            <p className="text-[12.5px] text-ink-mid mb-5">
              This information is used by your AI receptionist when talking to customers.
            </p>
            <OrgProfileForm
              initial={{
                name: org.name,
                website: org.website ?? "",
                phone: org.phone ?? "",
                email: org.email ?? "",
                address: org.address ?? "",
                timezone: org.timezone,
                currency: org.currency,
              }}
            />
          </Card>

          <Card className="p-6">
            <h2 className="text-[15px] font-semibold mb-1">Chat widget</h2>
            <p className="text-[12.5px] text-ink-mid mb-4">
              Paste this one line on any website to put your AI receptionist on it:
            </p>
            <code className="block font-mono text-[11.5px] bg-hover border border-line rounded-lg px-3 py-2.5 select-all break-all mb-3">
              {`<script src="${baseUrl}/widget.js" data-key="${org.widgetKey}" async></script>`}
            </code>
            <div className="flex items-center gap-3 mb-5">
              <RotateKeyButton />
              <span className="text-[11.5px] text-ink-soft">
                Rotate if the key was exposed — old snippets stop working instantly.
              </span>
            </div>
            <WidgetSettingsForm
              initial={{
                widgetColor: config.widgetColor,
                widgetPosition: config.widgetPosition,
                showBranding: config.showBranding,
              }}
            />
          </Card>

          <Card className="p-6">
            <h2 className="text-[15px] font-semibold mb-1">Password</h2>
            <p className="text-[12.5px] text-ink-mid mb-5">
              Change the password you use to sign in.
            </p>
            <ChangePasswordForm />
          </Card>

          <Card className="p-6">
            <h2 className="text-[15px] font-semibold mb-1">Two-factor authentication</h2>
            <p className="text-[12.5px] text-ink-mid mb-5">
              Protect your account with a 6-digit code from an authenticator app.
            </p>
            <TwoFactorCard enabled={Boolean(user.totpEnabledAt)} />
          </Card>
        </div>
      </div>
    </>
  );
}
