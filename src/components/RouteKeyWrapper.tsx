"use client";

import { usePathname } from "next/navigation";

/**
 * Wraps app children with a key derived from pathname so that on route change
 * React remounts the subtree. This avoids "removeChild: node to be removed is not a child"
 * errors that can occur with next-intl + App Router during navigation.
 */
export default function RouteKeyWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  return <div key={pathname || "root"} className="contents">{children}</div>;
}
