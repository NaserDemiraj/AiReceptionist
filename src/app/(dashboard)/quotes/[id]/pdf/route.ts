import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { renderQuotePdf } from "@/features/quotes/pdf";

/** GET /quotes/[id]/pdf — streams the branded PDF (session-authenticated). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { org } = await requireOrg();
  const { id } = await params;

  const quote = await prisma.quote.findFirst({
    where: { id, organizationId: org.id },
    include: { customer: true },
  });
  if (!quote) {
    return NextResponse.json({ error: { message: "Not found" } }, { status: 404 });
  }

  const bytes = await renderQuotePdf(quote, org, quote.customer);

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.number}.pdf"`,
    },
  });
}
