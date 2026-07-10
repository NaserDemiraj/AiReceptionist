import Link from "next/link";
import { Bot } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-canvas px-4 py-10">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <span className="w-[34px] h-[34px] rounded-[9px] bg-accent flex items-center justify-center">
          <Bot size={18} color="#fff" strokeWidth={2.2} />
        </span>
        <span className="font-bold text-[16px] tracking-tight text-ink">AI Receptionist</span>
      </Link>
      {children}
    </div>
  );
}
