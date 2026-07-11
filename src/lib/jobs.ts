import { addHours, format } from "date-fns";
import { prisma } from "./prisma";
import { logger } from "./logger";

export interface AutomationRunResult {
  remindersSent: number;
  followUpsSent: number;
}

const REMINDER_TEMPLATES: Record<string, (when: string) => string> = {
  en: (when) =>
    `Friendly reminder: your visit is coming up ${when}. We're looking forward to seeing you! Reply here if you need to reschedule.`,
  sq: (when) =>
    `Kujtesë miqësore: vizita juaj është ${when}. Ju presim me kënaqësi! Na shkruani këtu nëse doni ta ndryshoni orarin.`,
  de: (when) =>
    `Freundliche Erinnerung: Ihr Termin ist ${when}. Wir freuen uns auf Sie! Schreiben Sie uns hier, falls Sie umbuchen möchten.`,
};

const FOLLOWUP_TEMPLATES: Record<string, (interest: string | null) => string> = {
  en: (interest) =>
    interest
      ? `Hi again! Just checking in — ${interest} is still available. Would you like more details, photos, or to book a quick showroom visit?`
      : `Hi again! Just checking in — can I help you find anything, or book you a showroom visit?`,
  sq: (interest) =>
    interest
      ? `Përshëndetje përsëri! Doja t'ju kujtoja — ${interest} është ende në gjendje. Dëshironi më shumë detaje, foto, apo një vizitë në showroom?`
      : `Përshëndetje përsëri! A mund t'ju ndihmoj me diçka, apo të rezervojmë një vizitë në showroom?`,
  de: (interest) =>
    interest
      ? `Hallo nochmal! Kurze Info — ${interest} ist noch verfügbar. Möchten Sie mehr Details, Fotos oder einen Showroom-Besuch vereinbaren?`
      : `Hallo nochmal! Kann ich Ihnen bei etwas helfen oder einen Showroom-Besuch für Sie vereinbaren?`,
};

/**
 * Runs due automations for one org (dashboard button) or all orgs (cron).
 * Idempotent: reminders are marked via reminderSentAt, follow-ups via
 * message metadata, so running twice never double-sends.
 */
export async function runAutomations(orgId?: string): Promise<AutomationRunResult> {
  const result: AutomationRunResult = { remindersSent: 0, followUpsSent: 0 };
  const now = new Date();

  const configs = await prisma.aiConfig.findMany({
    where: orgId ? { organizationId: orgId } : {},
    include: { organization: { select: { id: true, timezone: true } } },
  });

  for (const config of configs) {
    const org = config.organization;

    /* ---- Appointment reminders (due within 24h, not yet reminded) ---- */
    if (config.remindersEnabled) {
      const due = await prisma.appointment.findMany({
        where: {
          organizationId: org.id,
          status: { in: ["PENDING", "CONFIRMED"] },
          reminderSentAt: null,
          startsAt: { gte: now, lte: addHours(now, 24) },
        },
        include: {
          customer: {
            include: { conversations: { orderBy: { updatedAt: "desc" }, take: 1 } },
          },
        },
      });

      for (const appt of due) {
        const lang = appt.customer.language in REMINDER_TEMPLATES ? appt.customer.language : "en";
        const when = format(appt.startsAt, "EEEE 'at' HH:mm");
        const conversation = appt.customer.conversations[0];

        // Email reminder too, when we have an address (best effort)
        if (appt.customer.email) {
          try {
            const { sendEmail, emailLayout } = await import("./email");
            await sendEmail({
              to: appt.customer.email,
              subject: `Reminder: your visit ${when}`,
              html: emailLayout(
                "Appointment reminder",
                `<p>Hi ${appt.customer.name ?? "there"},</p>
                 <p>${REMINDER_TEMPLATES[lang](when)}</p>`,
              ),
            });
          } catch {
            /* logged inside sendEmail */
          }
        }

        const ops = [];
        if (conversation) {
          ops.push(
            prisma.message.create({
              data: {
                conversationId: conversation.id,
                role: "AI",
                content: REMINDER_TEMPLATES[lang](when),
                metadata: { automation: "reminder", appointmentId: appt.id },
              },
            }),
          );
        }
        ops.push(
          prisma.appointment.update({
            where: { id: appt.id },
            data: { reminderSentAt: now },
          }),
          prisma.notification.create({
            data: {
              organizationId: org.id,
              type: "SYSTEM",
              title: "Reminder sent",
              body: `${appt.customer.name ?? "Customer"} — visit ${when}`,
              payload: { appointmentId: appt.id },
            },
          }),
        );
        await prisma.$transaction(ops);
        result.remindersSent++;
      }
    }

    /* ---- Lead follow-ups (conversation went quiet after AI reply) ---- */
    if (config.followUpsEnabled) {
      const cutoff = new Date(now.getTime() - config.followUpAfterHours * 3600_000);
      const quiet = await prisma.conversation.findMany({
        where: {
          organizationId: org.id,
          status: "AI_ACTIVE",
          updatedAt: { lt: cutoff },
          leads: { some: { status: { in: ["NEW", "CONTACTED", "QUALIFIED"] } } },
        },
        include: {
          leads: { orderBy: { createdAt: "desc" }, take: 1 },
          messages: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        take: 25,
      });

      for (const conv of quiet) {
        const last = conv.messages[0];
        // Only nudge if the customer left the AI's last message hanging,
        // and never nudge twice.
        if (!last || last.role !== "AI") continue;
        const alreadyFollowedUp = await prisma.message.findFirst({
          where: {
            conversationId: conv.id,
            metadata: { path: ["automation"], equals: "followup" },
          },
          select: { id: true },
        });
        if (alreadyFollowedUp) continue;

        const lang = conv.language in FOLLOWUP_TEMPLATES ? conv.language : "en";
        await prisma.$transaction([
          prisma.message.create({
            data: {
              conversationId: conv.id,
              role: "AI",
              content: FOLLOWUP_TEMPLATES[lang](conv.leads[0]?.interestedIn ?? null),
              metadata: { automation: "followup" },
            },
          }),
          prisma.conversation.update({
            where: { id: conv.id },
            data: { updatedAt: now },
          }),
        ]);
        result.followUpsSent++;
      }
    }
  }

  if (result.remindersSent || result.followUpsSent) {
    logger.info(result, "automation run complete");
  }
  return result;
}
