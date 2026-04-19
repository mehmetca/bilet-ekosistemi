"use client";

import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

const navigation = createNavigation(routing);

if (process.env.NODE_ENV === "development" && typeof navigation.Link !== "function") {
  console.error("next-intl createNavigation().Link is not a function; check bundling.");
}

export const Link = navigation.Link;
export const redirect = navigation.redirect;
export const usePathname = navigation.usePathname;
export const useRouter = navigation.useRouter;
export const getPathname = navigation.getPathname;
