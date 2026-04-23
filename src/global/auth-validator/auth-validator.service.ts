import { BadGatewayException, Injectable, UnauthorizedException } from "@nestjs/common";

import { Socket } from "socket.io";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { JwtServices } from "./jwt.service";

@Injectable()
export class AuthValidatorService {
    constructor(
        private readonly jwtService: JwtServices,
        private readonly prisma: PrismaService,
    ) {}

    async validateSocketToken(socket: Socket) {
        // const parsed = cookie.parse(rawCookie);
        const token = this.extractToken(socket);
        if (!token) {
            throw new BadGatewayException("Unauthorized user - Token not found in cookie");
        }

        const isVerifiedToken = await this.jwtService.verifyAsync(token);

        if (!isVerifiedToken?.sub || !isVerifiedToken?.email) {
            throw new BadGatewayException("Invalid or expired token");
        }

        const user = await this.prisma.user.findUnique({
            where: { id: isVerifiedToken.sub },
        });

        if (!user) {
            throw new BadGatewayException("Unauthorized User ❌", {
                description: "User not foudn with that email & id",
            });
        }

        if (!user.isVerified) {
            throw new UnauthorizedException("Please verify your account first");
        }
        return user;
    }

    private extractToken(client: Socket) {
        // Common approaches: `auth` in handshake (v4), or query param
        // Example using auth handshake: socket = io(url, { auth: { token } })
        return (
            (client.handshake.auth && client.handshake.auth.token) ||
            client.handshake.query?.token ||
            client.handshake.headers.cookie ||
            client.handshake.headers.authorization
        );
    }
}
