import { ENVEnum } from "@common/enum/env.enum";
import { JWTPayload } from "@common/jwt/jwt.interface";
import { Global, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";

@Injectable()
export class JwtServices {
    constructor(
        private readonly service: JwtService,
        private readonly configService: ConfigService,
    ) {}

    public async signAsync<T extends JWTPayload>(
        payload: T,
        options?: JwtSignOptions,
    ): Promise<string> {
        return await this.service.signAsync(payload, {
            ...options,
            expiresIn: this.configService.getOrThrow(ENVEnum.JWT_EXPIRES_IN),
            secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
        });
    }

    public async verifyAsync<T extends JWTPayload>(
        token: string,
        options: JwtSignOptions = {
            secret: this.configService.getOrThrow(ENVEnum.JWT_SECRET),
        },
    ) {
        return (await this.service.verifyAsync(token, {
            ...options,
            audience: "",
        })) as T;
    }
}
