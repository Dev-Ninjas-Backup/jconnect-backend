import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import * as bcrypt from "bcrypt";
import { ClassConstructor, plainToInstance } from "class-transformer";
import { PrismaService } from "../prisma/prisma.service";
import { JWTPayload } from "src/common/jwt/jwt.interface";
import { ENVEnum } from "src/common/enum/env.enum";

@Injectable()
export class UtilsService {
    private readonly saltRounds = 10;

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {}

    sanitizedResponse(dto: any, data: any) {
        return plainToInstance(dto, data, { excludeExtraneousValues: true });
    }

    sanitizeWithRelations<T>(dto: ClassConstructor<any>, entity: Record<string, any>): T {
        // Separate scalar fields from relations
        const scalars: Record<string, any> = {};
        const relations: Record<string, any> = {};

        for (const key in entity) {
            const value = entity[key];
            if (value !== null && typeof value === "object" && !Array.isArray(value)) {
                // This is either a relation object or a Prisma _count
                relations[key] = value;
            } else if (Array.isArray(value)) {
                // Relation arrays
                relations[key] = value;
            } else {
                // Scalar value
                scalars[key] = value;
            }
        }

        // Sanitize only scalars
        const sanitizedBase = this.sanitizedResponse(dto, scalars);

        // Merge sanitized scalars back with untouched relations
        return {
            ...sanitizedBase,
            ...relations,
        } as T;
    }

    removeDuplicateIds(ids: string[]) {
        return Array.from(new Set(ids));
    }

    async hash(value: string): Promise<string> {
        return bcrypt.hash(value, this.saltRounds);
    }

    async compare(value: string, hash: string): Promise<boolean> {
        return bcrypt.compare(value, hash);
    }

    generateToken(payload: JWTPayload): string {
        const token = this.jwtService.sign(
            payload as any,
            {
                secret: this.configService.get<string>(ENVEnum.JWT_SECRET),
                expiresIn: this.configService.get<string>(ENVEnum.JWT_EXPIRES_IN),
            } as any,
        );

        return token;
    }

    // ---------otp generate---------------
    generateOtpAndExpiry(): { otp: number; expiryTime: Date } {
        const otp = Math.floor(100000 + Math.random() * 900000);
        const expiryTime = new Date();
        expiryTime.setMinutes(expiryTime.getMinutes() + 10);
        return { otp, expiryTime };
    }
}
