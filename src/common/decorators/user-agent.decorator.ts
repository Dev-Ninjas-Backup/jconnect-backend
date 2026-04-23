// ==================== src/common/decorators/user-agent.decorator.ts ====================
import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Request } from "express";

export const UserAgent = createParamDecorator((data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<Request>();
    return request.headers["user-agent"] || "Unknown";
});
