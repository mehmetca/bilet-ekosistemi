import type { HTMLAttributes } from "react";
import { cn } from "./cn";

export type CardTone = "white" | "paper" | "ink";

const TONES: Record<CardTone, string> = {
  white: "border-ink-200 bg-white text-ink-900",
  paper: "border-ink-200 bg-paper text-ink-900",
  ink: "border-ink-800 bg-ink-950 text-ink-100",
};

type CardClassOptions = {
  tone?: CardTone;
  padded?: boolean;
  hover?: boolean;
  className?: string;
};

export function cardClass({
  tone = "white",
  padded = false,
  hover = false,
  className,
}: CardClassOptions = {}): string {
  return cn(
    "rounded-lg border shadow-card",
    TONES[tone],
    padded && "p-5",
    hover &&
      "transition duration-200 hover:-translate-y-0.5 hover:border-gold-300 hover:shadow-lift",
    className
  );
}

type CardProps = HTMLAttributes<HTMLDivElement> & CardClassOptions;

export default function Card({ tone, padded, hover, className, ...rest }: CardProps) {
  return <div className={cardClass({ tone, padded, hover, className })} {...rest} />;
}
