export const validationType = ["EMAIL", "PHONE"] as const;
export type ValidationType = (typeof validationType)[number];

// AuthProvider as string constants
export const authProvider = ["GOOGLE", "FACEBOOK"] as const;
export type AuthProvider = (typeof authProvider)[number];

export const role = [
    "USER",
    "MODERATOR",
    "ADMIN",
    "SUPER_ADMIN",
    "FINANCE_ADMIN",
    "SUPPORT_ADMIN",
    "ANALYST",
    "MEMBER",
    "ARTIST",
] as const;
export type Role = (typeof role)[number];
