"use server";

import { AuthError } from "next-auth";

import { signIn } from "@/auth";
import { resolveAdminLocale } from "@/lib/admin-locale";

export type LoginState = {
  error?: string;
};

export async function authenticate(_: LoginState, formData: FormData): Promise<LoginState> {
  const locale = resolveAdminLocale(typeof formData.get("locale") === "string" ? String(formData.get("locale")) : null);

  try {
    await signIn("credentials", {
      username: formData.get("username"),
      password: formData.get("password"),
      redirectTo: "/admin"
    });

    return {};
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error: locale === "zh" ? "账号或密码不正确。" : "Incorrect username or password."
      };
    }

    throw error;
  }
}
