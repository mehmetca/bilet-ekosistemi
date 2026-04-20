"use client";

import NextLink from "next/link";
import { usePathname as useNextPathname, useRouter as useNextRouter } from "next/navigation";

export const Link = NextLink;
export const usePathname = useNextPathname;
export const useRouter = useNextRouter;
