import type { ComponentPropsWithoutRef, ReactNode } from "react";

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export { cx };

/* ============ Card ============ */

export function Card({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return (
    <div
      className={cx("bg-card border border-line rounded-[14px]", className)}
      {...props}
    />
  );
}

/* ============ Button ============ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-strong border border-transparent",
  secondary: "bg-card text-ink border border-line hover:bg-hover",
  ghost: "bg-transparent text-ink-mid hover:bg-hover border border-transparent",
  danger: "bg-danger text-white hover:opacity-90 border border-transparent",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentPropsWithoutRef<"button"> & { variant?: ButtonVariant }) {
  return (
    <button
      className={cx(
        "h-[38px] px-4 rounded-[10px] text-[13px] font-semibold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  );
}

/* ============ Badge ============ */

type BadgeTone = "accent" | "positive" | "warn" | "danger" | "neutral";

const badgeStyles: Record<BadgeTone, string> = {
  accent: "bg-accent-soft text-accent",
  positive: "bg-positive-soft text-positive-strong",
  warn: "bg-warn-soft text-warn",
  danger: "bg-danger-soft text-danger",
  neutral: "bg-hover text-ink-mid",
};

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 text-[11.5px] font-semibold px-2 py-0.5 rounded-md",
        badgeStyles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ============ Form field ============ */

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[13px] font-medium text-ink mb-1.5">{label}</span>
      {children}
    </label>
  );
}

export function Input({
  className,
  ...props
}: ComponentPropsWithoutRef<"input">) {
  return (
    <input
      className={cx(
        "w-full h-[40px] px-3.5 bg-card border border-line rounded-[10px] text-[13.5px] text-ink placeholder:text-ink-soft outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft transition",
        className,
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: ComponentPropsWithoutRef<"select">) {
  return (
    <select
      className={cx(
        "w-full h-[40px] px-3 bg-card border border-line rounded-[10px] text-[13.5px] text-ink outline-none focus:border-accent-line focus:ring-2 focus:ring-accent-soft transition",
        className,
      )}
      {...props}
    />
  );
}

/* ============ Empty state ============ */

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {icon && <div className="text-ink-soft mb-3">{icon}</div>}
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      {hint && <div className="text-[12.5px] text-ink-soft mt-1 max-w-sm">{hint}</div>}
    </div>
  );
}
