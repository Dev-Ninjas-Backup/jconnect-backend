import { AuthProvider, Role } from "@constant/enums";

export type MakeRequired<T, K extends keyof T> = T & { [P in K]-?: T[P] };

export type TUser = {
    userId: string;
    email: string;
    role: Role;
};

export type VerifiedUser = {
    id: string;
    email: string;
    authProvider: AuthProvider;
    isVerified: boolean;
    role: Role;

    createdAt: Date | string;
    updatedAt: Date | string;
    userId: string;
};

export type PaginatedResult<T> = {
    data: T[];
    nextCursor?: string;
};
