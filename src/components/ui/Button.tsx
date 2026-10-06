import type { ButtonHTMLAttributes } from "react";
import { cn } from "./cn";

export type ButtonVariant =
  | "primary"
  | "gold"
  | "outline"
  | "outlineLight"
  | "ghost"
  | "ghostLight"
  | "danger";

export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium tracking-tight " +
  "rounded-md transition-colors duration-150 select-none " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent " +
  "disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-gold-500 font-semibold text-ink-950 hover:bg-gold-400 active:bg-gold-600",
  gold: "bg-gold-500 font-semibold text-ink-950 hover:bg-gold-400 active:bg-gold-600",
  outline: "border border-ink-300 text-ink-800 hover:border-ink-900 hover:bg-ink-100",
  outlineLight: "border border-white/30 text-white hover:border-gold-400 hover:bg-white/10",
  ghost: "text-ink-700 hover:bg-ink-100 hover:text-ink-900",
  ghostLight: "text-white/75 hover:bg-white/10 hover:text-white",
  danger: "bg-red-700 text-white hover:bg-red-800",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-12 px-7 text-base",
};

type ButtonClassOptions = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
};

/** `<button>` dışında `<Link>` gibi öğelerde de aynı görünümü vermek için sınıf üretir. */
export function buttonClass({
  variant = "primary",
  size = "md",
  full = false,
  className,
}: ButtonClassOptions = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], full && "w-full", className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & ButtonClassOptions;

export default function Button({
  variant,
  size,
  full,
  className,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, size, full, className })}
      {...rest}
    >
      {children}
    </button>
  );
}
