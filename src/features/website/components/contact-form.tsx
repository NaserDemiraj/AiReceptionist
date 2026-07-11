"use client";

import { useActionState } from "react";
import { submitContactForm } from "../actions";

export function SiteContactForm({ slug, accent }: { slug: string; accent: string }) {
  const [state, formAction, pending] = useActionState(submitContactForm, undefined);

  if (state?.success) {
    return (
      <div className="bg-white border border-[#E8E8EC] rounded-2xl p-8 text-center">
        <div className="text-[17px] font-semibold text-[#17171A]">Message sent 🎉</div>
        <p className="text-[13.5px] text-[#6B6B76] mt-2">
          We got your message and will get back to you shortly — or ask our assistant in the
          chat bubble for an instant answer.
        </p>
      </div>
    );
  }

  const inputCls =
    "w-full h-[42px] px-3.5 bg-white border border-[#E0E0E6] rounded-[10px] text-[13.5px] text-[#17171A] placeholder:text-[#9A9AA5] outline-none focus:border-[#B9B7E8] transition";

  return (
    <form action={formAction} className="space-y-3.5">
      <input name="slug" type="hidden" value={slug} />
      <input name="name" required placeholder="Your name" className={inputCls} />
      <div className="grid sm:grid-cols-2 gap-3.5">
        <input name="email" type="email" placeholder="Email" className={inputCls} />
        <input name="phone" placeholder="Phone" className={inputCls} />
      </div>
      <textarea
        name="message"
        required
        rows={4}
        placeholder="How can we help?"
        className="w-full px-3.5 py-3 bg-white border border-[#E0E0E6] rounded-[10px] text-[13.5px] text-[#17171A] placeholder:text-[#9A9AA5] outline-none focus:border-[#B9B7E8] transition resize-y"
      />
      {state?.error && (
        <p className="text-[12.5px] text-[#C4362E] bg-[#FBEBEA] rounded-lg px-3 py-2">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="h-[46px] px-7 text-white rounded-xl text-[14px] font-semibold cursor-pointer disabled:opacity-60"
        style={{ background: accent }}
      >
        {pending ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
