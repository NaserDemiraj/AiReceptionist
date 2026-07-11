import Link from "next/link";
import { Bot } from "lucide-react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white text-ink">
      <nav className="h-16 border-b border-[#EEEEF0] flex items-center px-6 lg:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="w-[30px] h-[30px] rounded-lg bg-accent flex items-center justify-center">
            <Bot size={16} color="#fff" strokeWidth={2.2} />
          </span>
          <span className="font-bold text-[15.5px] tracking-tight">AI Receptionist</span>
        </Link>
      </nav>
      <main className="max-w-[720px] mx-auto px-6 py-14 [&_h1]:font-display [&_h1]:text-[30px] [&_h1]:font-semibold [&_h1]:tracking-tight [&_h2]:text-[17px] [&_h2]:font-semibold [&_h2]:mt-8 [&_h2]:mb-2 [&_p]:text-[14px] [&_p]:text-[#3A3A42] [&_p]:leading-[1.75] [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:space-y-1.5 [&_li]:text-[14px] [&_li]:text-[#3A3A42] [&_li]:leading-relaxed [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </main>
      <footer className="border-t border-[#F0F0F2] py-8 text-center text-[12.5px] text-ink-soft">
        © {new Date().getFullYear()} AI Receptionist ·{" "}
        <Link href="/" className="text-accent">
          Home
        </Link>
      </footer>
    </div>
  );
}
