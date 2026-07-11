import type { Metadata } from "next";
import Link from "next/link";
import Script from "next/script";
import { MapPin, Mail, Phone } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { getSite, parseServices } from "@/features/website/site-data";
import { SiteContactForm } from "@/features/website/components/contact-form";
import { formatMoney } from "@/features/shared/labels";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const org = await prisma.organization.findUnique({
    where: { slug },
    include: { site: true },
  });
  if (!org?.site) return {};
  return {
    title: org.site.seoTitle || `${org.name} — ${org.site.heroTitle ?? "Welcome"}`,
    description:
      org.site.seoDescription ||
      org.site.heroSubtitle ||
      `${org.name}: products, services and instant answers 24/7.`,
    robots: org.site.published ? undefined : { index: false },
  };
}

export default async function PublicSitePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { org, site } = await getSite(slug);
  const services = parseServices(site.services);
  const accent = site.primaryColor;

  const products = site.showProducts
    ? await prisma.product.findMany({
        where: { organizationId: org.id, isActive: true },
        orderBy: { updatedAt: "desc" },
        take: 6,
        include: { category: true },
      })
    : [];

  return (
    <div className="bg-white text-[#17171A] min-h-screen">
      {!site.published && (
        <div className="bg-[#F0E9DA] text-[#8A6D2F] text-center text-[12.5px] font-medium py-2">
          Preview — this site is not published yet. Publish it from your dashboard.
        </div>
      )}

      {/* NAV */}
      <nav className="sticky top-0 z-20 h-16 bg-white/90 backdrop-blur-lg border-b border-[#EEEEF0] flex items-center gap-6 px-6 lg:px-10">
        <span className="font-display font-bold text-[17px] tracking-tight">{org.name}</span>
        <div className="flex-1" />
        <div className="hidden sm:flex gap-6 text-[13.5px] text-[#5A5A64]">
          {site.aboutText && <a href="#about">About</a>}
          {services.length > 0 && <a href="#services">Services</a>}
          {site.showProducts && <Link href={`/site/${slug}/products`}>Products</Link>}
          {site.showContactForm && <a href="#contact">Contact</a>}
        </div>
        {org.phone && (
          <a
            href={`tel:${org.phone.replace(/\s/g, "")}`}
            className="h-9 px-4 rounded-[10px] text-[13px] font-semibold text-white flex items-center gap-1.5"
            style={{ background: accent }}
          >
            <Phone size={13} />
            <span className="hidden md:inline">{org.phone}</span>
            <span className="md:hidden">Call</span>
          </a>
        )}
      </nav>

      {/* HERO */}
      <header className="px-6 lg:px-10 pt-20 pb-24 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{ background: `radial-gradient(ellipse at top, ${accent}, transparent 65%)` }}
        />
        <h1 className="font-display text-[36px] md:text-[52px] font-semibold tracking-[-0.02em] leading-[1.08] max-w-[760px] mx-auto relative">
          {site.heroTitle ?? org.name}
        </h1>
        {site.heroSubtitle && (
          <p className="text-[16px] text-[#6B6B76] leading-relaxed max-w-[560px] mx-auto mt-5 relative">
            {site.heroSubtitle}
          </p>
        )}
        <div className="flex gap-3 justify-center mt-8 relative">
          {site.showProducts && (
            <Link
              href={`/site/${slug}/products`}
              className="h-12 px-7 rounded-xl text-[14.5px] font-semibold text-white flex items-center"
              style={{ background: accent }}
            >
              Browse products
            </Link>
          )}
          {site.showContactForm && (
            <a
              href="#contact"
              className="h-12 px-6 rounded-xl text-[14.5px] font-semibold border border-[#E0E0E6] flex items-center hover:bg-[#F7F7F8]"
            >
              Get in touch
            </a>
          )}
        </div>
      </header>

      {/* ABOUT */}
      {site.aboutText && (
        <section id="about" className="px-6 lg:px-10 py-16 bg-[#FAFAFB] border-y border-[#F0F0F2]">
          <div className="max-w-[720px] mx-auto text-center">
            <div
              className="font-mono text-[11.5px] tracking-[0.1em] uppercase mb-4"
              style={{ color: accent }}
            >
              About us
            </div>
            <p className="text-[15.5px] text-[#3A3A42] leading-[1.75] whitespace-pre-line">
              {site.aboutText}
            </p>
          </div>
        </section>
      )}

      {/* SERVICES */}
      {services.length > 0 && (
        <section id="services" className="px-6 lg:px-10 py-16 max-w-[1080px] mx-auto">
          <div
            className="font-mono text-[11.5px] tracking-[0.1em] uppercase mb-3 text-center"
            style={{ color: accent }}
          >
            What we do
          </div>
          <h2 className="font-display text-[28px] font-semibold text-center mb-10">Services</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {services.map((s) => (
              <div key={s.title} className="bg-[#FBFBFC] border border-[#EEEEF0] rounded-2xl p-6">
                <div
                  className="w-9 h-9 rounded-[10px] mb-4 opacity-90"
                  style={{ background: `${accent}22`, border: `1px solid ${accent}44` }}
                />
                <div className="text-[15px] font-semibold">{s.title}</div>
                {s.description && (
                  <p className="text-[13px] text-[#6B6B76] leading-relaxed mt-1.5">
                    {s.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* FEATURED PRODUCTS */}
      {site.showProducts && products.length > 0 && (
        <section className="px-6 lg:px-10 py-16 bg-[#FAFAFB] border-y border-[#F0F0F2]">
          <div className="max-w-[1080px] mx-auto">
            <div className="flex items-baseline justify-between mb-8">
              <h2 className="font-display text-[28px] font-semibold">Featured products</h2>
              <Link
                href={`/site/${slug}/products`}
                className="text-[13.5px] font-semibold"
                style={{ color: accent }}
              >
                View all →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {products.map((p) => (
                <div key={p.id} className="bg-white border border-[#EEEEF0] rounded-2xl overflow-hidden">
                  <div
                    className="h-[150px] flex items-end p-3"
                    style={{ background: `linear-gradient(135deg, ${accent}14, ${accent}30)` }}
                  >
                    {p.category && (
                      <span className="text-[10.5px] font-mono uppercase tracking-wide bg-white/85 rounded-md px-2 py-0.5 text-[#5A5A64]">
                        {p.category.name}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="text-[14.5px] font-semibold">{p.name}</div>
                    <div className="mt-1 text-[14px]">
                      {p.salePrice ? (
                        <>
                          <span className="font-semibold" style={{ color: accent }}>
                            {formatMoney(p.salePrice, p.currency)}
                          </span>{" "}
                          <span className="text-[12px] text-[#9A9AA5] line-through">
                            {formatMoney(p.price, p.currency)}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold">{formatMoney(p.price, p.currency)}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CONTACT */}
      {site.showContactForm && (
        <section id="contact" className="px-6 lg:px-10 py-16 max-w-[1000px] mx-auto">
          <h2 className="font-display text-[28px] font-semibold text-center mb-10">
            Get in touch
          </h2>
          <div className="grid lg:grid-cols-2 gap-10">
            <div className="space-y-4">
              {org.address && (
                <div className="flex items-start gap-3 text-[14px] text-[#3A3A42]">
                  <MapPin size={17} className="shrink-0 mt-0.5" style={{ color: accent }} />
                  {org.address}
                </div>
              )}
              {org.phone && (
                <div className="flex items-start gap-3 text-[14px] text-[#3A3A42]">
                  <Phone size={17} className="shrink-0 mt-0.5" style={{ color: accent }} />
                  {org.phone}
                </div>
              )}
              {org.email && (
                <div className="flex items-start gap-3 text-[14px] text-[#3A3A42]">
                  <Mail size={17} className="shrink-0 mt-0.5" style={{ color: accent }} />
                  {org.email}
                </div>
              )}
              {site.googleMapsUrl && (
                <iframe
                  src={site.googleMapsUrl}
                  className="w-full h-[220px] rounded-2xl border border-[#EEEEF0] mt-2"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Map"
                />
              )}
            </div>
            <SiteContactForm slug={slug} accent={accent} />
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer className="border-t border-[#F0F0F2] py-8 px-6 lg:px-10 flex items-center gap-3 max-w-[1080px] mx-auto text-[12.5px] text-[#9A9AA5] flex-wrap">
        <span className="font-semibold text-[#17171A]">{org.name}</span>
        <span>© {new Date().getFullYear()}</span>
        <div className="flex-1" />
        <span>
          Website &amp; AI receptionist by{" "}
          <span className="font-semibold text-[#5A5A64]">AI Receptionist</span>
        </span>
      </footer>

      {/* Chat widget — the whole point of the bundle */}
      <Script src="/widget.js" data-key={org.widgetKey} strategy="afterInteractive" />
    </div>
  );
}
