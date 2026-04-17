import "server-only";

import { cookies } from "next/headers";

import { ADMIN_LOCALE_COOKIE, resolveAdminLocale } from "@/lib/admin-locale";

export async function getAdminLocale() {
  const cookieStore = await cookies();
  return resolveAdminLocale(cookieStore.get(ADMIN_LOCALE_COOKIE)?.value);
}
