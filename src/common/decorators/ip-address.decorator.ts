// ==================== src/common/decorators/ip-address.decorator.ts ====================
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export const IpAddress = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();

    // Try to get real IP from various headers (for proxies/load balancers)
    const ip =
        (request.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        (request.headers["x-real-ip"] as string) ||
        request.connection?.remoteAddress ||
        request.socket?.remoteAddress ||
        "Unknown";

    return ip;
});

export default IpAddress;
