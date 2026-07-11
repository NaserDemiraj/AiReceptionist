"use server";

import { revalidatePath } from "next/cache";
import { requireOrg } from "@/lib/org";
import { runAutomations, type AutomationRunResult } from "@/lib/jobs";
import { forbidden } from "@/lib/errors";

export type RunState = ({ error?: string } & Partial<AutomationRunResult>) | undefined;

export async function runAutomationsNow(): Promise<RunState> {
  const { org, role } = await requireOrg();
  if (role === "AGENT") throw forbidden("Only owners and admins can run automations");

  const result = await runAutomations(org.id);
  revalidatePath("/automation");
  return result;
}
