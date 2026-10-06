import type { ReactNode } from "react";
import { cn } from "./cn";

type SectionTitleProps = {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  align?: "left" | "center";
  tone?: "light" | "dark";
  level?: "h2" | "h3";
  className?: string;
};

/** Bölüm başlığı: altın üst-etiket + serif başlık + ince altın ayraç (afiş geleneği). */
export default function SectionTitle({
  eyebrow,
  title,
  description,
  action,
  align = "left",
  tone = "light",
  level = "h2",
  className,
}: SectionTitleProps) {
  const Heading = level;
  const dark = tone === "dark";
  const centered = align === "center";

  return (
    <div
      className={cn(
        "mb-8 flex flex-wrap items-end gap-x-6 gap-y-4",
        centered && "flex-col items-center text-center",
        className
      )}
    >
      <div className={cn("min-w-0", centered ? "max-w-2xl" : "flex-1")}>
        {eyebrow ? (
          <span
            className={cn(
              "mb-2 block text-[11px] font-semibold uppercase tracking-widest2",
              dark ? "text-gold-400" : "text-gold-700"
            )}
          >
            {eyebrow}
          </span>
        ) : null}
        <Heading
          className={cn(
            "font-display text-2xl font-semibold tracking-tight md:text-3xl",
            dark ? "text-white" : "text-ink-900"
          )}
        >
          {title}
        </Heading>
        <span className={cn("mt-3 block h-px w-12 bg-gold-500", centered && "mx-auto")} />
        {description ? (
          <p
            className={cn(
              "mt-3 text-sm leading-relaxed md:text-base",
              dark ? "text-ink-300" : "text-ink-500"
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
