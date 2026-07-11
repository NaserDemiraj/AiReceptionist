import Link from "next/link";
import { ExternalLink, PanelsTopLeft } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import { Topbar } from "@/components/layout/topbar";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { WebsiteEditor } from "@/features/website/components/website-editor";
import { parseServices } from "@/features/website/site-data";

export const metadata = { title: "Website Builder" };

export default async function WebsiteBuilderPage() {
  const { org } = await requireOrg();

  const site =
    (await prisma.website.findUnique({ where: { organizationId: org.id } })) ??
    (await prisma.website.create({
      data: {
        organizationId: org.id,
        heroTitle: org.name,
        heroSubtitle: `Welcome to ${org.name} — ask our assistant anything, any time.`,
      },
    }));

  return (
    <>
      <Topbar
        title="Website Builder"
        actions={
          <Link
            href={`/site/${org.slug}`}
            target="_blank"
            className="h-9 px-4 bg-card border border-line hover:bg-hover text-ink rounded-[9px] text-[13px] font-semibold inline-flex items-center gap-1.5"
          >
            <ExternalLink size={14} />
            {site.published ? "View site" : "Preview site"}
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto px-[26px] pt-6 pb-10">
        <div className="max-w-[720px] space-y-4">
          <Card className="p-5 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[10px] bg-accent-soft text-accent flex items-center justify-center shrink-0">
              <PanelsTopLeft size={18} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[14px] font-semibold">Your public website</div>
              <code className="font-mono text-[12px] text-ink-mid select-all">
                /site/{org.slug}
              </code>
            </div>
            {site.published ? <Badge tone="positive">Live</Badge> : <Badge tone="warn">Draft</Badge>}
          </Card>

          <Card className="p-6">
            <WebsiteEditor
              initial={{
                published: site.published,
                heroTitle: site.heroTitle ?? "",
                heroSubtitle: site.heroSubtitle ?? "",
                aboutText: site.aboutText ?? "",
                primaryColor: site.primaryColor,
                seoTitle: site.seoTitle ?? "",
                seoDescription: site.seoDescription ?? "",
                googleMapsUrl: site.googleMapsUrl ?? "",
                showProducts: site.showProducts,
                showContactForm: site.showContactForm,
                services: parseServices(site.services),
              }}
            />
          </Card>
        </div>
      </div>
    </>
  );
}
