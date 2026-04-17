"use client";

import { useActionState } from "react";

import type { LoginState } from "@/app/admin/login/actions";
import { authenticate } from "@/app/admin/login/actions";
import type { AdminLocale } from "@/lib/admin-locale";

const initialState: LoginState = {};

type LoginFormProps = {
  locale: AdminLocale;
};

export function LoginForm({ locale }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(authenticate, initialState);
  const isZh = locale === "zh";

  return (
    <form action={formAction} className="auth-form">
      <input type="hidden" name="locale" value={locale} />
      <div className="field-stack">
        <label className="field-label" htmlFor="username">
          {isZh ? "管理员账号" : "Admin username"}
        </label>
        <input id="username" name="username" type="text" autoComplete="username" required className="field-input" />
      </div>
      <div className="field-stack">
        <label className="field-label" htmlFor="password">
          {isZh ? "管理员密码" : "Admin password"}
        </label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className="field-input" />
      </div>
      {state.error ? <p className="form-error">{state.error}</p> : null}
      <button type="submit" className="primary-button auth-submit" disabled={pending}>
        {pending ? (isZh ? "验证中..." : "Verifying...") : isZh ? "进入后台" : "Enter admin"}
      </button>
    </form>
  );
}
