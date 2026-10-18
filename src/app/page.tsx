import Link from "next/link";
import {
  Bot,
  CalendarCheck,
  Check,
  FileText,
  MessageSquare,
  PhoneMissed,
  Play,
  Search,
  UserPlus,
} from "lucide-react";

const FEATURES = [
  {
    icon: MessageSquare,
    bg: "#EEEDFB",
    fg: "#5B57D4",
    title: "Instant conversations",
    body: "Human-like replies in 1.4 seconds, 24/7, in the customer's own language.",
  },
  {
    icon: Search,
    bg: "#EAF7F0",
    fg: "#12805C",
    title: "Smart catalog search",
    body: "“A grey corner sofa under €900” returns the right products, instantly.",
  },
  {
    icon: CalendarCheck,
    bg: "#DEE7F0",
    fg: "#2B5A8A",
    title: "Appointment booking",
    body: "Books showroom visits and consultations, synced to your calendar with reminders.",
  },
  {
    icon: UserPlus,
    bg: "#F0E9DA",
    fg: "#8A6D2F",
    title: "Automatic lead capture",
    body: "Collects name, budget and interest — then follows up if they go quiet.",
  },
  {
    icon: FileText,
    bg: "#F0DEE9",
    fg: "#8A2B6D",
    title: "Instant quotes",
    body: "Generates a professional quote as a PDF and emails it automatically.",
  },
  {
    icon: PhoneMissed,
    bg: "#FBEBEA",
    fg: "#C4362E",
    title: "Missed-call recovery",
    body: "Texts back every missed caller within 30 seconds and keeps selling.",
  },
];

const PLANS = [
  {
    name: "Starter",
    tagline: "Solo shops testing the waters",
    price: "€49",
    per: "/mo",
    popular: false,
    cta: "Start free",
    features: ["1,000 conversations", "Website + 1 channel", "Lead capture", "Email support"],
  },
  {
    name: "Professional",
    tagline: "Growing stores with steady traffic",
    price: "€89",
    per: "/mo",
    popular: false,
    cta: "Start free",
    features: ["3,000 conversations", "3 channels", "Appointment booking", "Missed-call recovery"],
  },
  {
    name: "Business",
    tagline: "Full automation for busy showrooms",
    price: "€149",
    per: "/mo",
    popular: true,
    cta: "Start free trial",
    features: [
      "8,000 conversations",
      "5 channels",
      "All automations",
      "Quote generator",
      "Priority support",
    ],
  },
  {
    name: "Enterprise",
    tagline: "Multi-store, white-label & agencies",
    price: "Custom",
    per: "",
    popular: false,
    cta: "Contact sales",
    features: [
      "Unlimited conversations",
      "White-label branding",
      "Multi-business support",
      "SSO + audit logs",
      "Dedicated manager",
    ],
  },
];

const STEPS = [
  {
    n: "1",
    title: "Connect your catalog",
    body: "Sync your CMS, upload PDFs or point us at your website. The AI indexes everything automatically.",
  },
  {
    n: "2",
    title: "Set its personality",
    body: "Name it, pick a tone and languages, and choose when it should hand off to your team.",
  },
  {
    n: "3",
    title: "Go live everywhere",
    body: "Paste one snippet on your site and connect WhatsApp & Instagram. It's answering instantly.",
  },
];

function Logo({ size = 30 }: { size?: number }) {
  return (
    <div
      className="rounded-lg bg-accent flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <Bot size={size * 0.55} color="#fff" strokeWidth={2.2} />
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="bg-white text-ink">
      {/* NAV */}
      <nav className="sticky top-0 z-20 h-16 bg-white/85 backdrop-blur-lg border-b border-[#EEEEF0] flex items-center gap-3.5 px-6 lg:px-10">
        <div className="flex items-center gap-2.5">
          <Logo />
          <span className="font-bold text-[15.5px] tracking-tight">AI Receptionist</span>
        </div>
        <div className="hidden md:flex gap-[26px] ml-8 text-[13.5px] text-[#5A5A64]">
          <a href="#features">Features</a>
          <a href="#how">How it works</a>
          <a href="#pricing">Pricing</a>
        </div>
        <div className="flex-1" />
        <Link href="/login" className="text-[13.5px] font-medium text-[#5A5A64] hover:text-ink">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="h-[38px] px-[17px] bg-accent hover:bg-accent-strong text-white rounded-[10px] flex items-center text-[13.5px] font-semibold"
        >
          Start free trial
        </Link>
      </nav>

      {/* HERO */}
      <section className="bg-gradient-to-b from-[#1A1730] via-[#221D42] to-[#2A2450] text-white px-6 lg:px-10 pt-[90px] pb-[100px] text-center relative overflow-hidden">
        <div className="inline-flex items-center gap-2 bg-white/[0.08] border border-white/[0.12] px-3.5 py-1.5 rounded-[20px] text-[12.5px] text-[#C7C3FF] mb-[26px]">
          <span className="w-[7px] h-[7px] rounded-full bg-[#4ADE80] animate-pulse-dot" />
          Now answering in English, Albanian &amp; German
        </div>
        <h1 className="font-display text-[40px] md:text-[60px] font-semibold leading-[1.04] tracking-[-0.03em] max-w-[850px] mx-auto">
          Hire an AI receptionist,
          <br />
          not another chatbot.
        </h1>
        <p className="text-[17px] text-[#B8B4E0] leading-relaxed max-w-[600px] mx-auto mt-6">
          A 24/7 employee that answers customers instantly, recommends products, books
          appointments, and recovers every missed call — across web, WhatsApp &amp; Instagram.
        </p>
        <div className="flex gap-[13px] justify-center mt-[34px] flex-wrap">
          <Link
            href="/signup"
            className="h-[50px] px-[26px] bg-accent hover:bg-accent-strong rounded-xl flex items-center text-[15px] font-semibold"
          >
            Start 14-day free trial
          </Link>
          <Link
            href="/demo"
            className="h-[50px] px-6 bg-white/[0.08] border border-white/[0.15] rounded-xl flex items-center gap-2 text-[15px] font-semibold"
          >
            <Play size={17} fill="#fff" />
            Try the live demo
          </Link>
        </div>
        <div className="text-[12.5px] text-[#8A85B8] mt-[18px]">
          No credit card required · Live in under 10 minutes
        </div>

        {/* stat row */}
        <div className="flex justify-center mt-14 flex-wrap max-w-[760px] mx-auto">
          {[
            ["86%", "of chats resolved without staff"],
            ["1.4s", "average response time"],
            ["+31%", "revenue influenced"],
          ].map(([stat, label], i) => (
            <div
              key={stat}
              className={`flex-1 min-w-[170px] px-6 ${i > 0 ? "border-l border-white/[0.12]" : ""}`}
            >
              <div className="font-display text-[34px] font-semibold">{stat}</div>
              <div className="text-[12.5px] text-[#8A85B8] mt-1">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TRUST */}
      <section className="py-[34px] px-10 border-b border-[#F0F0F2]">
        <div className="text-center text-[12px] font-mono text-ink-soft tracking-[0.08em] uppercase mb-[22px]">
          Trusted by growing businesses across 10+ industries
        </div>
        <div className="flex gap-11 justify-center items-center flex-wrap opacity-55">
          <span className="font-display font-bold text-[19px] tracking-wider">MAMAJ</span>
          <span className="font-bold text-[17px]">DentaCare</span>
          <span className="font-bold text-[17px] italic">Bella Salon</span>
          <span className="font-bold text-[17px]">FitZone</span>
          <span className="font-bold text-[17px] tracking-[0.1em]">NOVA REALTY</span>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-20 px-6 lg:px-10 max-w-[1180px] mx-auto">
        <div className="text-center mb-[50px]">
          <div className="text-[12.5px] font-mono text-accent tracking-[0.06em] uppercase mb-3">
            One employee, every job
          </div>
          <h2 className="font-display text-[30px] md:text-[38px] font-semibold tracking-[-0.02em]">
            Everything a great front-desk does.
            <br />
            Automatically.
          </h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-[18px]">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                className="bg-[#FBFBFC] border border-[#EEEEF0] rounded-2xl p-6 transition-all hover:-translate-y-[3px] hover:border-accent-line"
              >
                <div
                  className="w-11 h-11 rounded-[11px] flex items-center justify-center mb-4"
                  style={{ background: f.bg, color: f.fg }}
                >
                  <Icon size={22} strokeWidth={2} />
                </div>
                <div className="text-[16px] font-semibold tracking-[-0.01em]">{f.title}</div>
                <p className="text-[13.5px] text-ink-mid leading-relaxed mt-2">{f.body}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* MISSED CALL (dark band) */}
      <section className="bg-[#17141F] text-white py-[76px] px-6 lg:px-10">
        <div className="max-w-[1080px] mx-auto grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-[#C4362E]/15 text-[#FF9E97] px-3 py-1.5 rounded-lg text-[11.5px] font-mono mb-[18px]">
              FLAGSHIP FEATURE
            </div>
            <h2 className="font-display text-[30px] md:text-[36px] font-semibold tracking-[-0.02em] leading-[1.1]">
              Never lose a customer
              <br />
              to a missed call again.
            </h2>
            <p className="text-[15px] text-[#A9A6C4] leading-relaxed mt-[18px] max-w-[440px]">
              The moment a call goes unanswered, your AI texts the caller back within 30 seconds
              and continues the conversation — turning missed calls into booked visits.
            </p>
            <div className="flex gap-[30px] mt-7">
              <div>
                <div className="font-display text-[28px] font-semibold">&lt;30s</div>
                <div className="text-[12px] text-[#8A85B8] mt-[3px]">response time</div>
              </div>
              <div>
                <div className="font-display text-[28px] font-semibold">63%</div>
                <div className="text-[12px] text-[#8A85B8] mt-[3px]">calls recovered</div>
              </div>
            </div>
          </div>
          {/* phone mock */}
          <div className="justify-self-center w-[280px] bg-black rounded-[34px] p-3 shadow-[0_30px_70px_-20px_rgba(0,0,0,0.6)]">
            <div className="bg-[#0C0A12] rounded-[26px] overflow-hidden">
              <div className="h-[34px] flex items-center justify-center">
                <div className="w-20 h-5 bg-black rounded-[20px]" />
              </div>
              <div className="px-3.5 pt-3.5 pb-[22px]">
                <div className="text-center text-[11px] text-[#6B6878] mb-3.5 font-mono">
                  Missed call · 20:46
                </div>
                <div className="bg-[#1C1927] rounded-[14px] rounded-bl-[4px] px-[13px] py-[11px] text-[13px] text-[#E5E3F0] leading-normal mb-2.5">
                  Hi! Sorry we missed your call at MAMAJ Furniture 🙌 How can I help?
                </div>
                <div className="bg-accent rounded-[14px] rounded-br-[4px] px-[13px] py-[11px] text-[13px] text-white leading-normal mb-2.5 ml-10">
                  Do you still have the grey Oslo sofa?
                </div>
                <div className="bg-[#1C1927] rounded-[14px] rounded-bl-[4px] px-[13px] py-[11px] text-[13px] text-[#E5E3F0] leading-normal">
                  Yes — 14 in stock at €899. Want to book a visit this weekend?
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 px-6 lg:px-10 max-w-[1080px] mx-auto">
        <div className="text-center mb-[50px]">
          <div className="text-[12.5px] font-mono text-accent tracking-[0.06em] uppercase mb-3">
            Live in 10 minutes
          </div>
          <h2 className="font-display text-[30px] md:text-[38px] font-semibold tracking-[-0.02em]">
            Three steps. No retraining.
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div key={s.n} className="text-center">
              <div className="w-[52px] h-[52px] rounded-[14px] bg-accent-soft text-accent flex items-center justify-center mx-auto mb-[18px] font-display text-[20px] font-bold">
                {s.n}
              </div>
              <div className="text-[16px] font-semibold">{s.title}</div>
              <p className="text-[13.5px] text-ink-mid leading-relaxed mt-2">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="px-6 lg:px-10 pb-20">
        <div className="max-w-[820px] mx-auto bg-[#FBFBFC] border border-[#EEEEF0] rounded-[20px] px-8 md:px-12 py-11 text-center">
          <div className="font-display text-[20px] md:text-[24px] font-medium leading-[1.45] tracking-[-0.01em]">
            &ldquo;It genuinely feels like we hired another salesperson. Sara books showroom
            visits while we sleep — we recovered{" "}
            <span className="text-accent">€42k in influenced sales</span> in the first month
            alone.&rdquo;
          </div>
          <div className="flex items-center justify-center gap-3 mt-[26px]">
            <div className="w-11 h-11 rounded-full bg-[#E9E8F9] text-accent flex items-center justify-center font-semibold text-[15px]">
              BM
            </div>
            <div className="text-left">
              <div className="text-[14px] font-semibold">Blerta Mema</div>
              <div className="text-[12.5px] text-ink-soft">Owner, MAMAJ Furniture</div>
            </div>
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="px-6 lg:px-10 pb-[90px] max-w-[1180px] mx-auto">
        <div className="text-center mb-11">
          <h2 className="font-display text-[30px] md:text-[38px] font-semibold tracking-[-0.02em]">
            Simple, scalable pricing
          </h2>
          <p className="text-[15px] text-ink-mid mt-3">
            Start free. Upgrade as your conversations grow. Cancel anytime.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`rounded-2xl px-[22px] py-[26px] relative transition-all hover:-translate-y-[3px] ${
                p.popular
                  ? "bg-[#1E1B33] border-2 border-accent text-white"
                  : "bg-[#FBFBFC] border border-[#EEEEF0]"
              }`}
            >
              {p.popular && (
                <span className="absolute -top-[11px] left-1/2 -translate-x-1/2 text-[10.5px] font-semibold font-mono text-white bg-accent px-3 py-[3px] rounded-[20px]">
                  MOST POPULAR
                </span>
              )}
              <div className="text-[15px] font-semibold">{p.name}</div>
              <div
                className={`text-[12.5px] mt-1 min-h-[34px] ${p.popular ? "text-[#9A96C4]" : "text-ink-soft"}`}
              >
                {p.tagline}
              </div>
              <div className="mt-4 mb-5">
                <span className="font-display text-[32px] font-semibold">{p.price}</span>
                <span className={`text-[13px] ${p.popular ? "text-[#9A96C4]" : "text-ink-soft"}`}>
                  {p.per}
                </span>
              </div>
              <Link
                href="/signup"
                className={`h-10 flex items-center justify-center rounded-[10px] text-[13px] font-semibold ${
                  p.popular
                    ? "bg-accent text-white hover:bg-accent-strong"
                    : p.name === "Enterprise"
                      ? "bg-ink text-white"
                      : "bg-white border border-line text-ink hover:bg-hover"
                }`}
              >
                {p.cta}
              </Link>
              <div className="flex flex-col gap-2.5 mt-5">
                {p.features.map((f) => (
                  <div
                    key={f}
                    className={`flex items-start gap-2 text-[12.5px] leading-snug ${
                      p.popular ? "text-[#C9C6E0]" : "text-[#5A5A64]"
                    }`}
                  >
                    <Check
                      size={14}
                      strokeWidth={2.5}
                      className={`shrink-0 mt-px ${p.popular ? "text-[#8B87E8]" : "text-positive"}`}
                    />
                    {f}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FINAL CTA */}
      <section className="px-6 lg:px-10 pb-[90px]">
        <div className="max-w-[1080px] mx-auto bg-gradient-to-br from-[#221D42] to-[#2E2758] rounded-3xl px-8 md:px-12 py-16 text-center text-white relative overflow-hidden">
          <h2 className="font-display text-[32px] md:text-[40px] font-semibold tracking-[-0.02em] leading-[1.1]">
            Your next customer is
            <br />
            messaging right now.
          </h2>
          <p className="text-[16px] text-[#B8B4E0] mt-4">
            Give them an answer in seconds — even at 2am.
          </p>
          <div className="flex gap-[13px] justify-center mt-[30px] flex-wrap">
            <Link
              href="/signup"
              className="h-[50px] px-7 bg-accent hover:bg-accent-strong rounded-xl flex items-center text-[15px] font-semibold"
            >
              Start free trial
            </Link>
            <Link
              href="/demo"
              className="h-[50px] px-6 bg-white/10 border border-white/[0.16] rounded-xl flex items-center text-[15px] font-semibold"
            >
              See a live demo
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-[#F0F0F2] py-10 px-6 lg:px-10 flex items-center gap-3.5 max-w-[1180px] mx-auto flex-wrap">
        <div className="flex items-center gap-2.5">
          <Logo size={26} />
          <span className="font-bold text-[14px]">AI Receptionist</span>
        </div>
        <span className="text-[12.5px] text-ink-soft">© 2026 · Built for small business</span>
        <div className="flex-1" />
        <div className="flex gap-[22px] text-[13px] text-ink-mid">
          <Link href="/privacy" className="hover:text-ink">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-ink">
            Terms
          </Link>
          <a href="mailto:hello@aireceptionist.app" className="hover:text-ink">
            Contact
          </a>
        </div>
      </footer>
    </div>
  );
}
