import Link from "next/link";
import { CheckCircle2, XCircle } from "lucide-react";
import { verifyEmailToken } from "@/features/auth/actions";

export const metadata = { title: "Verify email" };

export default async function VerifyEmailPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const result = await verifyEmailToken(token);

  return (
    <div className="min-h-screen flex items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-[400px] bg-surface border border-line rounded-[14px] p-8 text-center">
        {result === "verified" ? (
          <>
            <CheckCircle2 size={40} className="mx-auto text-positive-strong mb-4" />
            <h1 className="text-[17px] font-semibold mb-2">Email confirmed</h1>
            <p className="text-[13px] text-ink-mid mb-6">
              Your email address is verified — you&apos;re all set.
            </p>
          </>
        ) : (
          <>
            <XCircle size={40} className="mx-auto text-danger mb-4" />
            <h1 className="text-[17px] font-semibold mb-2">
              {result === "expired" ? "Link expired" : "Invalid link"}
            </h1>
            <p className="text-[13px] text-ink-mid mb-6">
              {result === "expired"
                ? "This confirmation link has expired. Sign in and request a new one from the dashboard banner."
                : "This confirmation link isn't valid. Sign in and request a new one from the dashboard banner."}
            </p>
          </>
        )}
        <Link
          href="/dashboard"
          className="inline-block text-[13px] font-medium text-accent hover:underline"
        >
          Go to dashboard →
        </Link>
      </div>
    </div>
  );
}
