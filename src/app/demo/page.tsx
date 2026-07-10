import Script from "next/script";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Widget demo" };

/**
 * Fake customer-facing store page used to try the chat widget.
 * /demo          → uses the MAMAJ Furniture demo tenant
 * /demo?org=slug → any other tenant
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { org: slug } = await searchParams;
  const org = await prisma.organization.findFirst({
    where: slug ? { slug } : { slug: "mamaj-furniture" },
    include: { aiConfig: true },
  });

  if (!org) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-ink-mid text-[14px]">
          No organization found — run <code>npm run db:seed</code> first.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F1EC] text-[#2A2724]">
      {/* Fake store nav */}
      <nav className="h-16 bg-white border-b border-[#E8E4DC] flex items-center px-8 gap-8">
        <span className="font-display font-bold text-[19px] tracking-[0.04em]">
          {org.name.toUpperCase()}
        </span>
        <div className="hidden sm:flex gap-6 text-[13.5px] text-[#6E6A63]">
          <span>Living room</span>
          <span>Bedroom</span>
          <span>Dining</span>
          <span>Offers</span>
        </div>
        <div className="flex-1" />
        <span className="text-[12.5px] text-[#6E6A63]">{org.phone}</span>
      </nav>

      {/* Fake hero */}
      <div className="max-w-[900px] mx-auto px-8 py-20 text-center">
        <div className="font-mono text-[11px] tracking-[0.14em] uppercase text-[#9C968A] mb-4">
          Demo store page
        </div>
        <h1 className="font-display text-[42px] font-semibold tracking-tight leading-tight">
          This is what your customers see.
        </h1>
        <p className="text-[15px] text-[#6E6A63] mt-4 max-w-[540px] mx-auto leading-relaxed">
          The chat bubble in the bottom-right corner is your AI receptionist
          {org.aiConfig ? ` — ${org.aiConfig.assistantName}` : ""}. Ask about products
          (&ldquo;a grey corner sofa under €900&rdquo;), share your contact details, or book a
          showroom visit — then watch it all appear in your dashboard.
        </p>
        <div className="grid sm:grid-cols-3 gap-4 mt-14">
          {["Oslo Corner Sofa", "Luna Upholstered Bed", "Vera Dining Table"].map((name) => (
            <div key={name} className="bg-white rounded-2xl border border-[#E8E4DC] p-4">
              <div className="h-[120px] rounded-xl bg-[#EDE9E1] mb-3" />
              <div className="text-[13.5px] font-semibold">{name}</div>
              <div className="text-[12px] text-[#9C968A] mt-0.5">Ask the assistant about it →</div>
            </div>
          ))}
        </div>
      </div>

      {/* The actual widget snippet — same one any business would paste */}
      <Script src="/widget.js" data-key={org.widgetKey} strategy="afterInteractive" />
    </div>
  );
}
