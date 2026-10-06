import type { InputHTMLAttributes, LabelHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

const FIELD_BASE =
  "w-full rounded-md border border-ink-300 bg-white text-[0.9375rem] text-ink-900 " +
  "placeholder:text-ink-400 transition-colors " +
  "focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/25 " +
  "disabled:cursor-not-allowed disabled:bg-ink-50 disabled:text-ink-400";

export function inputClass(className?: string): string {
  return cn(FIELD_BASE, "h-11 px-3.5", className);
}

export function textareaClass(className?: string): string {
  return cn(FIELD_BASE, "min-h-24 px-3.5 py-2.5 leading-relaxed", className);
}

export function labelClass(className?: string): string {
  return cn(
    "mb-1.5 block text-[13px] font-semibold uppercase tracking-wider text-ink-600",
    className
  );
}

export default function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={inputClass(className)} {...rest} />;
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={textareaClass(className)} {...rest} />;
}

export function Label({ className, ...rest }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={labelClass(className)} {...rest} />;
}
