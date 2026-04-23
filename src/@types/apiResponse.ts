import { Request } from "express";

export interface AuthenticatedRequest extends Request {
    user: {
        [x: string]: any;
        sub: string;
        email: string;

        isVerified: boolean;
        profileId: string;
    };
}
