import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type BadgeVariant =
  | "gold"
  | "ink"
  | "outline"
  | "muted"
  | "success"
  | "danger"
  | "light"
  | "goldOnDark";

const VARIANTS: Record<BadgeVariant, string> = {
  gold: "border-gold-300 bg-gold-100 text-gold-900",
  ink: "border-ink-900 bg-ink-900 text-paper",
  outline: "border-ink-300 bg-transparent text-ink-600",
  muted: "border-ink-200 bg-ink-50 text-ink-600",
  success: "border-emerald-300 bg-emerald-50 text-emerald-800",
  danger: "border-red-300 bg-red-50 text-red-800",
  light: "border-white/25 bg-white/10 text-white",
  goldOnDark: "border-gold-500/40 bg-gold-500/15 text-gold-300",
};

const BASE =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 " +
  "text-[11px] font-semibold uppercase leading-5 tracking-wider";

export function badgeClass(variant: BadgeVariant = "muted", className?: string): string {
  return cn(BASE, VARIANTS[variant], className);
}

type BadgeProps = HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant };

export default function Badge({ variant = "muted", className, ...rest }: BadgeProps) {
  return <span className={badgeClass(variant, className)} {...rest} />;
}
