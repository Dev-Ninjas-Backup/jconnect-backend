import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets";
import * as jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { ENVEnum } from "src/common/enum/env.enum";
import { PrismaService } from "src/lib/prisma/prisma.service";

export enum RepostEvents {
    // ── Connection ──────────────────────────────────────
    ERROR = "repost:error",
    SUCCESS = "repost:success",

    // ── Server → Client (pushed after every REST action) ─
    ORDER_CREATED = "repost:order_created", // buyer + seller
    SELLER_ACCEPTED = "repost:seller_accepted", // buyer + seller
    SELLER_REJECTED = "repost:seller_rejected", // buyer + seller
    PROOF_SUBMITTED = "repost:proof_submitted", // buyer + seller
    PROOF_REVIEWED = "repost:proof_reviewed", // buyer + seller
    REDO_REQUESTED = "repost:redo_requested", // buyer + seller
    ORDER_COMPLETED = "repost:order_completed", // buyer + seller
    ORDER_REFUNDED = "repost:order_refunded", // buyer + seller
    COUNTDOWN_ALERT = "repost:countdown_alert", // seller only

    // ── Client → Server (bidirectional) ─────────────────
    JOIN_ORDER = "repost:join_order", // join order room for live updates
    LEAVE_ORDER = "repost:leave_order", // leave order room
    GET_ORDER = "repost:get_order", // fetch latest order state
}

@WebSocketGateway({
    cors: { origin: "*" },
    namespace: "/repost",
})
export class RepostOrderGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(RepostOrderGateway.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {}

    @WebSocketServer()
    server: Server;

    afterInit() {
        this.logger.log("RepostOrderGateway initialized — namespace: /repost");
    }

    // ─────────────────────────────────────────────────────────────
    // Connection / Auth
    // ─────────────────────────────────────────────────────────────

    async handleConnection(client: Socket) {
        const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;

        if (!authHeader) {
            client.emit(RepostEvents.ERROR, { message: "Missing authorization header" });
            client.disconnect(true);
            return;
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            client.emit(RepostEvents.ERROR, { message: "Missing token" });
            client.disconnect(true);
            return;
        }

        try {
            const jwtSecret = this.configService.get<string>(ENVEnum.JWT_SECRET);
            const payload: any = jwt.verify(token, jwtSecret as string);
            const userId = payload.sub;

            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true },
            });
            if (!user) {
                client.emit(RepostEvents.ERROR, { message: "User not found" });
                client.disconnect(true);
                return;
            }

            client.data.userId = userId;
            client.join(userId); // personal room — receives all order events
            client.emit(RepostEvents.SUCCESS, { userId });
            this.logger.log(`Repost: User ${userId} connected (${client.id})`);
        } catch (err) {
            client.emit(RepostEvents.ERROR, { message: err.message });
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Repost: disconnected ${client.id}`);
    }

    // ─────────────────────────────────────────────────────────────
    // Client → Server: join / leave / get a specific order room
    // ─────────────────────────────────────────────────────────────

    @SubscribeMessage(RepostEvents.JOIN_ORDER)
    async handleJoinOrder(@MessageBody() orderId: string, @ConnectedSocket() client: Socket) {
        const userId = this.getUserId(client);
        if (!userId) return;

        const order = await this.prisma.repostOrder.findFirst({
            where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] },
        });
        if (!order) {
            client.emit(RepostEvents.ERROR, { message: "Order not found or access denied" });
            return;
        }

        client.join(`order:${orderId}`);
        client.emit(RepostEvents.SUCCESS, { joined: `order:${orderId}` });
        this.logger.log(`User ${userId} joined order:${orderId}`);
    }

    @SubscribeMessage(RepostEvents.LEAVE_ORDER)
    handleLeaveOrder(@MessageBody() orderId: string, @ConnectedSocket() client: Socket) {
        client.leave(`order:${orderId}`);
        this.logger.log(`User ${client.data.userId} left order:${orderId}`);
    }

    @SubscribeMessage(RepostEvents.GET_ORDER)
    async handleGetOrder(@MessageBody() orderId: string, @ConnectedSocket() client: Socket) {
        const userId = this.getUserId(client);
        if (!userId) return;

        const order = await this.prisma.repostOrder.findFirst({
            where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] },
            include: {
                listing: true,
                buyer: { select: { id: true, username: true, profilePhoto: true } },
                seller: { select: { id: true, username: true, profilePhoto: true } },
            },
        });

        if (!order) {
            client.emit(RepostEvents.ERROR, { message: "Order not found" });
            return;
        }

        const ms = order.countdownEndsAt.getTime() - Date.now();
        client.emit(RepostEvents.GET_ORDER, {
            ...order,
            timeRemaining:
                ms > 0
                    ? { expired: false, ms, minutes: Math.floor(ms / 60000) }
                    : { expired: true, ms: 0, minutes: 0 },
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Server → Client: emit helpers called from service / scheduler
    // ─────────────────────────────────────────────────────────────

    emitOrderCreated(order: any) {
        this.push([order.buyerId, order.sellerId], RepostEvents.ORDER_CREATED, order);
    }

    emitSellerAccepted(order: any) {
        this.push([order.buyerId, order.sellerId], RepostEvents.SELLER_ACCEPTED, order);
    }

    emitSellerRejected(order: any) {
        this.push([order.buyerId, order.sellerId], RepostEvents.SELLER_REJECTED, order);
    }

    emitProofSubmitted(order: any) {
        this.push([order.buyerId, order.sellerId], RepostEvents.PROOF_SUBMITTED, order);
    }

    emitProofReviewed(order: any) {
        this.push([order.buyerId, order.sellerId], RepostEvents.PROOF_REVIEWED, order);
    }

    emitRedoRequested(order: any) {
        this.push([order.buyerId, order.sellerId], RepostEvents.REDO_REQUESTED, order);
    }

    emitOrderCompleted(order: any) {
        this.push([order.buyerId, order.sellerId], RepostEvents.ORDER_COMPLETED, order);
    }

    emitOrderRefunded(order: any) {
        this.push([order.buyerId, order.sellerId], RepostEvents.ORDER_REFUNDED, order);
    }

    emitCountdownAlert(order: any, minutesLeft: number) {
        this.server.to(order.sellerId).emit(RepostEvents.COUNTDOWN_ALERT, {
            orderId: order.id,
            minutesLeft,
            countdownEndsAt: order.countdownEndsAt,
            timestamp: new Date().toISOString(),
        });
    }

    // ─────────────────────────────────────────────────────────────
    // Private helpers
    // ─────────────────────────────────────────────────────────────

    private push(userIds: string[], event: RepostEvents, data: any) {
        const payload = { ...data, timestamp: new Date().toISOString() };
        for (const uid of userIds) {
            if (uid) this.server.to(uid).emit(event, payload);
        }
        // also push to any client that joined the order room directly
        if (data?.id) {
            this.server.to(`order:${data.id}`).emit(event, payload);
        }
    }

    private getUserId(client: Socket): string | null {
        const userId = client.data?.userId;
        if (!userId) {
            client.emit(RepostEvents.ERROR, { message: "Not authenticated" });
            client.disconnect(true);
        }
        return userId ?? null;
    }
}
