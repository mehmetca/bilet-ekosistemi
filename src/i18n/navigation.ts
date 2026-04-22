"use client";

import { createElement, type ComponentProps } from "react";
import NextLink from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";
import { routing } from "./routing";

type LinkProps = ComponentProps<typeof NextLink>;

function detectLocaleFromPathname(pathname: string | null): string {
  const match = pathname?.match(/^\/(tr|de|en|ku|ckb)(?:\/|$)/);
  return match?.[1] || routing.defaultLocale;
}

function isExcludedFromLocalePrefix(href: string): boolean {
  return ["/yonetim", "/auth", "/api", "/_next"].some(
    (prefix) => href === prefix || href.startsWith(`${prefix}/`)
  );
}

function localizeHref(href: LinkProps["href"], pathname: string | null): LinkProps["href"] {
  if (typeof href !== "string") return href;
  if (!href) return href;
  if (href.startsWith("http://") || href.startsWith("https://") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return href;
  }
  if (href.startsWith("#")) return href;

  const locale = detectLocaleFromPathname(pathname);
  if (href.startsWith("/#")) return `/${locale}${href}`;
  if (!href.startsWith("/")) return href;
  if (isExcludedFromLocalePrefix(href)) return href;
  if (/^\/(tr|de|en|ku|ckb)(?:\/|$)/.test(href)) return href;
  if (href === "/") return `/${locale}`;
  return `/${locale}${href}`;
}

export function Link(props: LinkProps) {
  const pathname = useNextPathname();
  const localizedHref = localizeHref(props.href, pathname);
  return createElement(NextLink, { ...props, href: localizedHref });
}

export const usePathname = useNextPathname;
export const useRouter = useNextRouter;
