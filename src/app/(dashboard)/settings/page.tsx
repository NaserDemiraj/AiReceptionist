import { Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { OrgProfileForm } from "@/features/settings/components/org-profile-form";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { org } = await requireOrg();

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
            <h2 className="text-[15px] font-semibold mb-1">Chat widget key</h2>
            <p className="text-[12.5px] text-ink-mid mb-4">
              Identifies your business to the embeddable chat widget (wired up in Milestone 2).
            </p>
            <code className="block font-mono text-[12.5px] bg-hover border border-line rounded-lg px-3 py-2.5 select-all">
              {org.widgetKey}
            </code>
          </Card>
        </div>
      </div>
    </>
  );
}
