import { isProductionBuild, requireEnv } from "@/lib/env";

const buildPlaceholders = {
  ADMIN_USERNAME: "__AUTH_ADMIN_USERNAME_BUILD__",
  ADMIN_PASSWORD: "__AUTH_ADMIN_PASSWORD_BUILD__",
  AUTH_SECRET: "__AUTH_SECRET_BUILD__"
} as const;

function readAuthEnv(name: keyof typeof buildPlaceholders) {
  const value = process.env[name]?.trim();
  if (value) {
    return value;
  }

  if (isProductionBuild()) {
    return buildPlaceholders[name];
  }

  return requireEnv(name);
}

export function getAdminUsername() {
  return readAuthEnv("ADMIN_USERNAME");
}

export function getAdminPassword() {
  return readAuthEnv("ADMIN_PASSWORD");
}

export function getAuthSecret() {
  return readAuthEnv("AUTH_SECRET");
}
