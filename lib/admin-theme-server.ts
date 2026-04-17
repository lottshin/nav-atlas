import "server-only";

import { cookies } from "next/headers";

import { ADMIN_THEME_COOKIE, resolveAdminTheme } from "@/lib/admin-theme";

export async function getAdminTheme() {
  const cookieStore = await cookies();
  return resolveAdminTheme(cookieStore.get(ADMIN_THEME_COOKIE)?.value);
}
