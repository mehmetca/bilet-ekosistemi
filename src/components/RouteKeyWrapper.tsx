"use client";

import { Fragment } from "react";
import { usePathname } from "next/navigation";

/**
 * Remounts locale subtree when the pathname changes. Mitigates
 * "removeChild: The node to be removed is not a child of this node" from
 * next-intl Link/navigation + App Router reconciling against a stale tree.
 * Fragment + key avoids an extra DOM node (safer than display:contents wrapper).
 */
export default function RouteKeyWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return <Fragment key={pathname || "root"}>{children}</Fragment>;
}
