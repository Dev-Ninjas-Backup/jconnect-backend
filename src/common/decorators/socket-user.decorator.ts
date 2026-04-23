import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Socket } from "socket.io";

export const RATE_LIMIT_KEY = "socket_rate_limit";
// export const SocketRateLimit = (config: RateLimitConfig) => SetMetadata(RATE_LIMIT_KEY, config);

export const GetSocketUser = createParamDecorator(<T>(_: unknown, context: ExecutionContext): T => {
    const client: Socket = context.switchToWs().getClient();
    return client.data.user as T;
});
