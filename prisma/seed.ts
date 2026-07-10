/**
 * Seeds two tenants:
 *  1. MAMAJ Furniture — the flagship demo org with a full furniture catalog,
 *     conversations, leads, appointments, and notifications.
 *  2. DentaCare — a second org whose data must NEVER appear when logged
 *     into MAMAJ (multi-tenancy verification).
 *
 * Login: demo@mamaj.com / mamaj1234
 */
import { PrismaClient } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000);
const daysFromNow = (d: number, hour = 10, min = 0) => {
  const dt = new Date();
  dt.setDate(dt.getDate() + d);
  dt.setHours(hour, min, 0, 0);
  return dt;
};

async function main() {
  console.log("Clearing existing data…");
  // Order matters (FKs). Cascades handle children of orgs.
  await prisma.organization.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creating users…");
  const password = await hash("mamaj1234", 12);
  const owner = await prisma.user.create({
    data: { email: "demo@mamaj.com", passwordHash: password, name: "Blerta Mema" },
  });
  const agent = await prisma.user.create({
    data: { email: "ardit@mamaj.com", passwordHash: password, name: "Ardit Hoxha" },
  });
  const otherOwner = await prisma.user.create({
    data: { email: "demo@dentacare.com", passwordHash: password, name: "Elira Shala" },
  });

  console.log("Creating MAMAJ Furniture…");
  const org = await prisma.organization.create({
    data: {
      name: "MAMAJ Furniture",
      slug: "mamaj-furniture",
      industry: "furniture",
      planTier: "BUSINESS",
      defaultLanguage: "en",
      languages: ["en", "sq", "de"],
      timezone: "Europe/Tirane",
      currency: "EUR",
      website: "https://mamaj-furniture.com",
      phone: "+355 69 204 5566",
      email: "hello@mamaj-furniture.com",
      address: "Rruga e Kavajës 112, Tirana",
      memberships: {
        create: [
          { userId: owner.id, role: "OWNER" },
          { userId: agent.id, role: "AGENT" },
        ],
      },
      aiConfig: {
        create: {
          assistantName: "Sara",
          greeting: "Hi! I'm Sara from MAMAJ Furniture 👋 How can I help you today?",
          instructions:
            "You are the receptionist for MAMAJ Furniture, a family furniture store in Tirana. Delivery within Albania takes 3-7 days. Assembly is free for orders over €500. All products carry a 24-month warranty. Payment: cash, card, or 12-month installments.",
          tone: "friendly-professional",
        },
      },
      subscription: {
        create: {
          plan: "BUSINESS",
          status: "ACTIVE",
          billingCycle: "monthly",
          currentPeriodEnd: daysFromNow(21),
        },
      },
    },
  });

  console.log("Creating catalog…");
  const categoryNames = [
    ["Sofas", "sofas"],
    ["Beds", "beds"],
    ["Dining", "dining"],
    ["Wardrobes", "wardrobes"],
    ["Chairs & Armchairs", "chairs"],
    ["Tables", "tables"],
  ] as const;

  const categories: Record<string, string> = {};
  for (const [name, slug] of categoryNames) {
    const c = await prisma.productCategory.create({
      data: { organizationId: org.id, name, slug },
    });
    categories[slug] = c.id;
  }

  type P = [
    cat: string, name: string, price: number, sale: number | null, stock: number,
    colors: string[], materials: string[], style: string,
    dims: Record<string, number>, delivery: number,
  ];
  const products: P[] = [
    ["sofas", "Oslo Corner Sofa", 899, null, 14, ["grey", "beige"], ["fabric", "oak"], "scandinavian", { widthCm: 260, depthCm: 160, heightCm: 84, seats: 5 }, 5],
    ["sofas", "Milano 3-Seater", 749, 649, 8, ["navy", "grey"], ["velvet", "beech"], "modern", { widthCm: 214, depthCm: 92, heightCm: 88, seats: 3 }, 4],
    ["sofas", "Verona Loveseat", 489, null, 11, ["cream", "olive"], ["fabric"], "classic", { widthCm: 156, depthCm: 90, heightCm: 86, seats: 2 }, 3],
    ["sofas", "Tirana Modular Sofa", 1290, 1090, 4, ["anthracite", "sand"], ["fabric", "steel"], "modern", { widthCm: 320, depthCm: 170, heightCm: 80, seats: 6 }, 7],
    ["sofas", "Nordic Sofa Bed", 679, null, 9, ["light grey", "dark grey"], ["fabric", "pine"], "scandinavian", { widthCm: 200, depthCm: 95, heightCm: 85, seats: 3 }, 5],
    ["beds", "Aria King Bed", 690, null, 7, ["walnut", "white"], ["mdf", "walnut veneer"], "modern", { widthCm: 196, depthCm: 216, heightCm: 105 }, 5],
    ["beds", "Luna Upholstered Bed", 549, 479, 12, ["grey", "blush"], ["fabric", "pine"], "modern", { widthCm: 176, depthCm: 215, heightCm: 112 }, 4],
    ["beds", "Skandi Oak Bed", 620, null, 6, ["natural oak"], ["solid oak"], "scandinavian", { widthCm: 168, depthCm: 210, heightCm: 90 }, 6],
    ["beds", "Roma Storage Bed", 799, null, 5, ["white", "graphite"], ["mdf"], "modern", { widthCm: 186, depthCm: 220, heightCm: 100 }, 6],
    ["beds", "Kids Loft Bed Max", 430, 389, 10, ["white", "blue"], ["pine"], "playful", { widthCm: 208, depthCm: 98, heightCm: 160 }, 4],
    ["dining", "Vera Dining Table (6)", 520, null, 9, ["oak", "black"], ["oak veneer", "steel"], "industrial", { widthCm: 180, depthCm: 90, heightCm: 76, seats: 6 }, 4],
    ["dining", "Extendable Nord Table", 690, 590, 5, ["white oak"], ["solid oak"], "scandinavian", { widthCm: 160, depthCm: 95, heightCm: 76, seats: 8 }, 6],
    ["dining", "Marble Top Dining Set", 1450, null, 2, ["white marble", "gold"], ["marble", "brass"], "luxury", { widthCm: 200, depthCm: 100, heightCm: 76, seats: 6 }, 10],
    ["dining", "Compact Duo Table", 260, null, 15, ["beech"], ["beech"], "classic", { widthCm: 110, depthCm: 70, heightCm: 75, seats: 4 }, 3],
    ["wardrobes", "Nova Sliding Wardrobe", 840, 749, 6, ["white", "oak/white"], ["mdf", "mirror"], "modern", { widthCm: 220, depthCm: 62, heightCm: 218 }, 7],
    ["wardrobes", "Classic 4-Door Wardrobe", 620, null, 8, ["walnut"], ["mdf", "walnut veneer"], "classic", { widthCm: 200, depthCm: 58, heightCm: 210 }, 6],
    ["wardrobes", "Open Concept Closet", 390, null, 12, ["black", "oak"], ["steel", "oak"], "industrial", { widthCm: 180, depthCm: 45, heightCm: 200 }, 4],
    ["chairs", "Elva Armchair", 340, 289, 13, ["mustard", "grey", "green"], ["velvet", "beech"], "mid-century", { widthCm: 78, depthCm: 82, heightCm: 90 }, 3],
    ["chairs", "Dining Chair Set (4)", 280, null, 20, ["black", "white", "grey"], ["polypropylene", "beech"], "modern", { widthCm: 46, depthCm: 52, heightCm: 82 }, 3],
    ["chairs", "Rocking Lounge Chair", 410, null, 4, ["cream"], ["bouclé", "steel"], "scandinavian", { widthCm: 70, depthCm: 100, heightCm: 88 }, 5],
    ["chairs", "Office Chair Ergo", 250, 219, 18, ["black", "grey"], ["mesh", "aluminium"], "modern", { widthCm: 65, depthCm: 65, heightCm: 120 }, 2],
    ["tables", "Loft Coffee Table", 240, null, 16, ["oak/black"], ["oak", "steel"], "industrial", { widthCm: 110, depthCm: 60, heightCm: 45 }, 3],
    ["tables", "Round Side Table Duo", 150, 129, 22, ["gold/black", "silver/white"], ["steel", "glass"], "modern", { widthCm: 50, depthCm: 50, heightCm: 55 }, 2],
    ["tables", "Console Table Vega", 310, null, 7, ["walnut"], ["walnut veneer"], "classic", { widthCm: 120, depthCm: 35, heightCm: 80 }, 4],
    ["tables", "Desk Studio 120", 290, null, 9, ["white", "oak"], ["mdf", "steel"], "minimal", { widthCm: 120, depthCm: 60, heightCm: 75 }, 3],
  ];

  const productIds: Record<string, string> = {};
  for (const [cat, name, price, sale, stock, colors, materials, style, dims, delivery] of products) {
    const p = await prisma.product.create({
      data: {
        organizationId: org.id,
        categoryId: categories[cat],
        sku: "MAM-" + name.replace(/[^A-Z0-9]/gi, "").slice(0, 8).toUpperCase(),
        name,
        description: `${name} — ${style} design in ${colors.join("/")}. Materials: ${materials.join(", ")}.`,
        price,
        salePrice: sale,
        currency: "EUR",
        stock,
        colors,
        materials,
        style,
        dimensions: dims,
        deliveryDays: delivery,
        warrantyMonths: 24,
      },
    });
    productIds[name] = p.id;
  }

  console.log("Creating customers & conversations…");
  const customersData = [
    { name: "Andi Leka", phone: "+355 68 300 1122", email: "andi.leka@gmail.com", language: "sq" },
    { name: "Miriam Weber", phone: "+49 171 555 8341", email: "m.weber@web.de", language: "de" },
    { name: "Sara Kola", phone: "+355 69 411 7788", email: "sara.kola@outlook.com", language: "en" },
    { name: "Genti Prela", phone: "+355 67 220 3344", email: null, language: "sq" },
    { name: "Emma Hoffmann", phone: null, email: "emma.h@gmail.com", language: "de" },
    { name: "Luis Marku", phone: "+355 69 909 1010", email: "luis.marku@gmail.com", language: "en" },
    { name: null, phone: null, email: null, language: "en", visitorId: "anon-4f8a2" },
  ];
  const customers = [];
  for (const c of customersData) {
    customers.push(
      await prisma.customer.create({
        data: { organizationId: org.id, ...c },
      }),
    );
  }

  // Conversation 1 — Andi, sofa inquiry -> lead + appointment (AI handled)
  const conv1 = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      customerId: customers[0].id,
      channel: "WEB",
      status: "RESOLVED",
      sentiment: "POSITIVE",
      language: "sq",
      subject: "Oslo corner sofa — showroom visit",
      firstResponseMs: 1400,
      createdAt: hoursAgo(30),
      updatedAt: hoursAgo(29),
      messages: {
        create: [
          { role: "CUSTOMER", content: "Përshëndetje! A e keni ende Oslo corner sofa gri në stok?", createdAt: hoursAgo(30) },
          { role: "AI", content: "Përshëndetje Andi! Po — Oslo Corner Sofa në ngjyrë gri është në stok (14 copë) me çmim €899. Dëshironi ta shihni në showroom këtë fundjavë?", createdAt: hoursAgo(30) },
          { role: "CUSTOMER", content: "Po, të shtunën në mëngjes nëse është e mundur.", createdAt: hoursAgo(29) },
          { role: "AI", content: "U rezervua! Ju presim të shtunën në orën 10:30. Do t'ju dërgojmë një kujtesë një ditë përpara. 😊", createdAt: hoursAgo(29) },
        ],
      },
    },
  });

  // Conversation 2 — Miriam (German), dining table, needs human
  await prisma.conversation.create({
    data: {
      organizationId: org.id,
      customerId: customers[1].id,
      channel: "WHATSAPP",
      status: "NEEDS_HUMAN",
      sentiment: "NEUTRAL",
      language: "de",
      subject: "Custom marble table request",
      firstResponseMs: 1800,
      createdAt: hoursAgo(5),
      updatedAt: hoursAgo(4),
      messages: {
        create: [
          { role: "CUSTOMER", content: "Hallo! Kann ich den Marmortisch auch in 240cm Länge bestellen?", createdAt: hoursAgo(5) },
          { role: "AI", content: "Hallo Miriam! Der Marble Top Dining Set ist standardmäßig 200cm lang. Sonderanfertigungen sind manchmal möglich — ich verbinde Sie mit einem Kollegen, der Ihnen die Details bestätigt.", createdAt: hoursAgo(5) },
          { role: "SYSTEM", content: "AI requested human handoff — custom order outside catalog", createdAt: hoursAgo(5) },
        ],
      },
    },
  });

  // Conversation 3 — Sara, bed under budget, active lead
  const conv3 = await prisma.conversation.create({
    data: {
      organizationId: org.id,
      customerId: customers[2].id,
      channel: "INSTAGRAM",
      status: "AI_ACTIVE",
      sentiment: "POSITIVE",
      language: "en",
      subject: "Bed under €600",
      firstResponseMs: 1200,
      createdAt: hoursAgo(2),
      updatedAt: hoursAgo(1),
      messages: {
        create: [
          { role: "CUSTOMER", content: "Hi! I'm looking for a modern double bed under €600.", createdAt: hoursAgo(2) },
          { role: "AI", content: "Great choice to ask! Two options fit perfectly: the Luna Upholstered Bed at €479 (on sale, grey or blush) and the Skandi Oak Bed at €620 — slightly above budget but solid oak. Want photos of either?", createdAt: hoursAgo(2) },
          { role: "CUSTOMER", content: "The Luna looks nice. What's the delivery time?", createdAt: hoursAgo(1) },
          { role: "AI", content: "The Luna Upholstered Bed delivers in 4 days anywhere in Albania, and assembly is free since it's part of our current promotion. Shall I reserve one in grey for you?", createdAt: hoursAgo(1) },
        ],
      },
    },
  });

  // Conversation 4 — Genti, missed call recovery
  await prisma.conversation.create({
    data: {
      organizationId: org.id,
      customerId: customers[3].id,
      channel: "SMS",
      status: "AI_ACTIVE",
      sentiment: "NEUTRAL",
      language: "sq",
      subject: "Missed call recovery",
      firstResponseMs: 25000,
      createdAt: hoursAgo(8),
      updatedAt: hoursAgo(7),
      messages: {
        create: [
          { role: "SYSTEM", content: "Missed call detected at 14:32 — recovery SMS sent", createdAt: hoursAgo(8) },
          { role: "AI", content: "Përshëndetje! Na vjen keq që humbëm telefonatën tuaj në MAMAJ Furniture. Si mund t'ju ndihmojmë?", createdAt: hoursAgo(8) },
          { role: "CUSTOMER", content: "Doja të pyesja për dollapët me dyer rrëshqitëse.", createdAt: hoursAgo(7) },
          { role: "AI", content: "Kemi Nova Sliding Wardrobe (220cm, me pasqyrë) tani me ulje €749 nga €840. Dëshironi më shumë detaje apo një vizitë në showroom?", createdAt: hoursAgo(7) },
        ],
      },
    },
  });

  // Conversation 5 — Emma, complaint, negative + human active
  await prisma.conversation.create({
    data: {
      organizationId: org.id,
      customerId: customers[4].id,
      channel: "FACEBOOK",
      status: "HUMAN_ACTIVE",
      sentiment: "NEGATIVE",
      language: "de",
      subject: "Delivery delay complaint",
      firstResponseMs: 1500,
      createdAt: hoursAgo(26),
      updatedAt: hoursAgo(3),
      messages: {
        create: [
          { role: "CUSTOMER", content: "Meine Lieferung ist schon 3 Tage zu spät. Das ist inakzeptabel!", createdAt: hoursAgo(26) },
          { role: "AI", content: "Das tut mir wirklich leid, Emma. Ich verstehe Ihren Ärger. Ich habe Ihre Bestellung gefunden und leite Sie sofort an unser Team weiter — Sie erhalten innerhalb von 30 Minuten eine Antwort.", createdAt: hoursAgo(26) },
          { role: "SYSTEM", content: "Negative sentiment detected — escalated to team", createdAt: hoursAgo(26) },
          { role: "AGENT", content: "Hallo Emma, hier ist Ardit von MAMAJ. Ihre Lieferung kommt morgen zwischen 9-12 Uhr. Als Entschuldigung schenken wir Ihnen die Liefergebühr und einen 10% Gutschein.", agentId: agent.id, createdAt: hoursAgo(3) },
        ],
      },
    },
  });

  // Conversation 6 — anonymous web visitor browsing
  await prisma.conversation.create({
    data: {
      organizationId: org.id,
      customerId: customers[6].id,
      channel: "WEB",
      status: "AI_ACTIVE",
      sentiment: "NEUTRAL",
      language: "en",
      subject: "Coffee table browsing",
      firstResponseMs: 1100,
      createdAt: hoursAgo(0.5),
      updatedAt: hoursAgo(0.4),
      messages: {
        create: [
          { role: "CUSTOMER", content: "Do you have industrial style coffee tables?", createdAt: hoursAgo(0.5) },
          { role: "AI", content: "Yes! The Loft Coffee Table (oak top, black steel legs, 110×60cm) is €240 with 16 in stock — delivery in 3 days. Would you like to see a photo?", createdAt: hoursAgo(0.4) },
        ],
      },
    },
  });

  console.log("Creating leads…");
  await prisma.lead.create({
    data: {
      organizationId: org.id,
      customerId: customers[0].id,
      conversationId: conv1.id,
      status: "VISIT_BOOKED",
      budget: 1000,
      interestedIn: "Oslo Corner Sofa (grey)",
      preferredContactTime: "Weekends, mornings",
      estimatedValue: 899,
      products: { create: [{ productId: productIds["Oslo Corner Sofa"] }] },
      createdAt: hoursAgo(29),
    },
  });
  await prisma.lead.create({
    data: {
      organizationId: org.id,
      customerId: customers[2].id,
      conversationId: conv3.id,
      status: "NEW",
      budget: 600,
      interestedIn: "Luna Upholstered Bed (grey)",
      estimatedValue: 479,
      products: { create: [{ productId: productIds["Luna Upholstered Bed"] }] },
      createdAt: hoursAgo(1),
    },
  });
  await prisma.lead.create({
    data: {
      organizationId: org.id,
      customerId: customers[3].id,
      status: "NEW",
      interestedIn: "Nova Sliding Wardrobe",
      estimatedValue: 749,
      products: { create: [{ productId: productIds["Nova Sliding Wardrobe"] }] },
      createdAt: hoursAgo(7),
    },
  });
  await prisma.lead.create({
    data: {
      organizationId: org.id,
      customerId: customers[1].id,
      status: "QUALIFIED",
      budget: 2000,
      interestedIn: "Custom marble dining table (240cm)",
      preferredContactTime: "After 18:00 CET",
      estimatedValue: 1450,
      products: { create: [{ productId: productIds["Marble Top Dining Set"] }] },
      createdAt: hoursAgo(4),
    },
  });
  await prisma.lead.create({
    data: {
      organizationId: org.id,
      customerId: customers[5].id,
      status: "WON",
      budget: 400,
      interestedIn: "Elva Armchair (mustard)",
      estimatedValue: 289,
      products: { create: [{ productId: productIds["Elva Armchair"] }] },
      createdAt: hoursAgo(72),
    },
  });

  console.log("Creating appointments…");
  await prisma.appointment.create({
    data: {
      organizationId: org.id,
      customerId: customers[0].id,
      staffId: owner.id,
      type: "SHOWROOM_VISIT",
      status: "CONFIRMED",
      startsAt: daysFromNow(2, 10, 30),
      endsAt: daysFromNow(2, 11, 0),
      notes: "Wants to see Oslo Corner Sofa in grey",
      confirmationSentAt: hoursAgo(29),
    },
  });
  await prisma.appointment.create({
    data: {
      organizationId: org.id,
      customerId: customers[1].id,
      staffId: agent.id,
      type: "CONSULTATION",
      status: "PENDING",
      startsAt: daysFromNow(1, 17, 0),
      endsAt: daysFromNow(1, 17, 30),
      notes: "Custom marble table sizing call",
    },
  });
  await prisma.appointment.create({
    data: {
      organizationId: org.id,
      customerId: customers[5].id,
      type: "DELIVERY",
      status: "CONFIRMED",
      startsAt: daysFromNow(0, 16, 0),
      endsAt: daysFromNow(0, 17, 0),
      notes: "Elva Armchair delivery + assembly",
      confirmationSentAt: hoursAgo(20),
    },
  });
  await prisma.appointment.create({
    data: {
      organizationId: org.id,
      customerId: customers[2].id,
      type: "SHOWROOM_VISIT",
      status: "PENDING",
      startsAt: daysFromNow(3, 12, 0),
      endsAt: daysFromNow(3, 12, 30),
      notes: "Luna bed viewing",
    },
  });

  console.log("Creating notifications…");
  await prisma.notification.createMany({
    data: [
      {
        organizationId: org.id,
        type: "HIGH_VALUE_LEAD",
        title: "High-value lead: Miriam Weber",
        body: "Budget €2,000 — interested in a custom marble dining table.",
        createdAt: hoursAgo(4),
      },
      {
        organizationId: org.id,
        type: "HUMAN_TAKEOVER",
        title: "Human needed: custom order request",
        body: "Sara (AI) escalated a WhatsApp conversation about a 240cm marble table.",
        createdAt: hoursAgo(5),
      },
      {
        organizationId: org.id,
        type: "APPOINTMENT_BOOKED",
        title: "Showroom visit booked",
        body: "Andi Leka — Saturday 10:30, Oslo Corner Sofa.",
        readAt: hoursAgo(20),
        createdAt: hoursAgo(29),
      },
      {
        organizationId: org.id,
        type: "NEGATIVE_SENTIMENT",
        title: "Upset customer detected",
        body: "Emma Hoffmann reports a 3-day delivery delay (Facebook).",
        readAt: hoursAgo(10),
        createdAt: hoursAgo(26),
      },
    ],
  });

  console.log("Creating second tenant (DentaCare)…");
  const org2 = await prisma.organization.create({
    data: {
      name: "DentaCare Clinic",
      slug: "dentacare-clinic",
      industry: "dental",
      planTier: "STARTER",
      memberships: { create: [{ userId: otherOwner.id, role: "OWNER" }] },
      aiConfig: { create: { assistantName: "Dea", greeting: "Welcome to DentaCare! How can I help?" } },
      subscription: { create: { status: "TRIALING", trialEndsAt: daysFromNow(10) } },
    },
  });
  const dentaCustomer = await prisma.customer.create({
    data: { organizationId: org2.id, name: "Test Patient", email: "patient@example.com" },
  });
  await prisma.conversation.create({
    data: {
      organizationId: org2.id,
      customerId: dentaCustomer.id,
      channel: "WEB",
      status: "AI_ACTIVE",
      subject: "Teeth whitening pricing — MUST NOT appear in MAMAJ",
      messages: {
        create: [{ role: "CUSTOMER", content: "How much is teeth whitening?" }],
      },
    },
  });

  console.log("\nSeed complete ✔");
  console.log("  MAMAJ login:    demo@mamaj.com / mamaj1234");
  console.log("  Agent login:    ardit@mamaj.com / mamaj1234");
  console.log("  DentaCare login: demo@dentacare.com / mamaj1234");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
