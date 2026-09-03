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

function orderTimeline(order: any) {
    if (!order?.createdAt) return undefined;
    return [
        { status: "PENDING", at: order.createdAt, description: null },
        { status: "IN_PROGRESS", at: order.inProgressAt ?? null, description: null },
        { status: "PROOF_SUBMITTED", at: order.proofSubmittedAt ?? null, description: null },
        {
            status: "RESUBMIT",
            at: order.resubmitAt ?? null,
            description: order.proofRejectReason ?? null,
        },
        { status: "RELEASED", at: order.releasedAt ?? null, description: null },
        { status: "CANCELLED", at: order.cancelledAt ?? null, description: null },
    ].filter((step) => step.at);
}

export enum OrderEvents {
    ERROR = "order:error",
    SUCCESS = "order:success",

    ORDER_CREATED = "order:created",
    IN_PROGRESS = "order:in_progress",
    PROOF_SUBMITTED = "order:proof_submitted",
    RELEASED = "order:released",
    CANCELLED = "order:cancelled",
    DELIVERY_DATE_UPDATED = "order:delivery_date_updated",
    PROOF_CANCELLED = "order:proof_cancelled",
    CANCEL_REQUEST_DECLINED = "order:cancel_request_declined",
    ORDER_DELETED = "order:deleted",
    SERVICE_REQUEST_UPDATED = "order:service_request_updated",

    JOIN_ORDER = "order:join_order",
    LEAVE_ORDER = "order:leave_order",
    GET_ORDER = "order:get_order",
}

@WebSocketGateway({
    cors: { origin: "*" },
    namespace: "/order",
})
export class OrderGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(OrderGateway.name);

    constructor(
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {}

    @WebSocketServer()
    server: Server;

    afterInit() {
        this.logger.log("OrderGateway initialized — namespace: /order");
    }

    async handleConnection(client: Socket) {
        const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;

        if (!authHeader) {
            client.emit(OrderEvents.ERROR, { message: "Missing authorization header" });
            client.disconnect(true);
            return;
        }

        const token = authHeader.split(" ")[1];
        if (!token) {
            client.emit(OrderEvents.ERROR, { message: "Missing token" });
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
                client.emit(OrderEvents.ERROR, { message: "User not found" });
                client.disconnect(true);
                return;
            }

            client.data.userId = userId;
            client.join(userId);
            client.emit(OrderEvents.SUCCESS, { userId });
            this.logger.log(`Order: User ${userId} connected (${client.id})`);
        } catch (err) {
            client.emit(OrderEvents.ERROR, { message: err.message });
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        this.logger.log(`Order: disconnected ${client.id}`);
    }

    @SubscribeMessage(OrderEvents.JOIN_ORDER)
    async handleJoinOrder(@MessageBody() orderId: string, @ConnectedSocket() client: Socket) {
        const userId = this.getUserId(client);
        if (!userId) return;

        const order = await this.prisma.order.findFirst({
            where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] },
        });
        if (!order) {
            client.emit(OrderEvents.ERROR, { message: "Order not found or access denied" });
            return;
        }

        client.join(`order:${orderId}`);
        client.emit(OrderEvents.SUCCESS, { joined: `order:${orderId}` });
        this.logger.log(`User ${userId} joined order:${orderId}`);
    }

    @SubscribeMessage(OrderEvents.LEAVE_ORDER)
    handleLeaveOrder(@MessageBody() orderId: string, @ConnectedSocket() client: Socket) {
        client.leave(`order:${orderId}`);
        this.logger.log(`User ${client.data.userId} left order:${orderId}`);
    }

    @SubscribeMessage(OrderEvents.GET_ORDER)
    async handleGetOrder(@MessageBody() orderId: string, @ConnectedSocket() client: Socket) {
        const userId = this.getUserId(client);
        if (!userId) return;

        const order = await this.prisma.order.findFirst({
            where: { id: orderId, OR: [{ buyerId: userId }, { sellerId: userId }] },
            include: {
                service: true,
                buyer: {
                    select: {
                        id: true,
                        username: true,
                        full_name: true,
                        profilePhoto: true,
                    },
                },
                seller: {
                    select: {
                        id: true,
                        username: true,
                        full_name: true,
                        profilePhoto: true,
                    },
                },
            },
        });

        if (!order) {
            client.emit(OrderEvents.ERROR, { message: "Order not found" });
            return;
        }

        client.emit(OrderEvents.GET_ORDER, {
            ...order,
            timeline: orderTimeline(order),
        });
    }

    emitOrderCreated(order: any) {
        this.push([order.buyerId, order.sellerId], OrderEvents.ORDER_CREATED, order);
    }

    emitInProgress(order: any) {
        this.push([order.buyerId, order.sellerId], OrderEvents.IN_PROGRESS, order);
    }

    emitProofSubmitted(order: any) {
        this.push([order.buyerId, order.sellerId], OrderEvents.PROOF_SUBMITTED, order);
    }

    emitReleased(order: any) {
        this.push([order.buyerId, order.sellerId], OrderEvents.RELEASED, order);
    }

    emitCancelled(order: any) {
        this.push([order.buyerId, order.sellerId], OrderEvents.CANCELLED, order);
    }

    emitDeliveryDateUpdated(order: any) {
        this.push([order.buyerId, order.sellerId], OrderEvents.DELIVERY_DATE_UPDATED, order);
    }

    emitProofCancelled(order: any) {
        this.push([order.buyerId, order.sellerId], OrderEvents.PROOF_CANCELLED, order);
    }

    emitCancelRequestDeclined(order: any) {
        this.push([order.buyerId, order.sellerId], OrderEvents.CANCEL_REQUEST_DECLINED, order);
    }

    emitOrderDeleted(order: any) {
        this.push([order.buyerId, order.sellerId], OrderEvents.ORDER_DELETED, order);
    }

    /**
     * Notify connected clients that a service request attached to an order has
     * changed (e.g. seller accepted/declined, buyer resubmitted files). The
     * order info page listens for this so it can refresh the promotion info /
     * timeline in real-time.
     */
    emitServiceRequestUpdated(orderId: string, userIds: string[], serviceRequest: any) {
        const payload = { ...serviceRequest, orderId, timestamp: new Date().toISOString() };
        for (const uid of userIds) {
            if (uid) this.server.to(uid).emit(OrderEvents.SERVICE_REQUEST_UPDATED, payload);
        }
        if (orderId) {
            this.server.to(`order:${orderId}`).emit(OrderEvents.SERVICE_REQUEST_UPDATED, payload);
        }
    }

    /** Map OrderStatus → event after a successful status mutation */
    emitStatusChange(order: any) {
        switch (order?.status) {
            case "IN_PROGRESS":
                this.emitInProgress(order);
                break;
            case "PROOF_SUBMITTED":
                this.emitProofSubmitted(order);
                break;
            case "RESUBMIT":
                this.emitProofCancelled(order);
                break;
            case "RELEASED":
                this.emitReleased(order);
                break;
            case "CANCELLED":
                this.emitCancelled(order);
                break;
            case "PENDING":
                this.emitOrderCreated(order);
                break;
            default:
                break;
        }
    }

    private push(userIds: string[], event: OrderEvents, data: any) {
        const payload = {
            ...data,
            timeline: orderTimeline(data),
            timestamp: new Date().toISOString(),
        };
        for (const uid of userIds) {
            if (uid) this.server.to(uid).emit(event, payload);
        }
        if (data?.id) {
            this.server.to(`order:${data.id}`).emit(event, payload);
        }
    }

    private getUserId(client: Socket): string | null {
        const userId = client.data?.userId;
        if (!userId) {
            client.emit(OrderEvents.ERROR, { message: "Not authenticated" });
            client.disconnect(true);
        }
        return userId ?? null;
    }
}
