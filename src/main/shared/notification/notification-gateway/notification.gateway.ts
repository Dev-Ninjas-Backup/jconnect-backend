import { JWTPayload } from "@common/jwt/jwt.interface";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import type {
    ServiceEvent,
    UserRegistration,
} from "@main/shared/notification/interface/events-payload";
import { Notification } from "@main/shared/notification/interface/events-payload";
import { EVENT_TYPES } from "@main/shared/notification/interface/events.name";
import { PayloadForSocketClient } from "@main/shared/notification/interface/socket-client-payload";
import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OnEvent } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { MailService } from "src/lib/mail/mail.service";
import { PrismaService } from "src/lib/prisma/prisma.service";

@WebSocketGateway({
    cors: { origin: "*" },
    namespace: "/notification",
})
@Injectable()
export class NotificationGateway
    implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
    private readonly logger = new Logger(NotificationGateway.name);
    private readonly clients = new Map<string, Set<Socket>>();

    constructor(
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly firebaseNotificationService: FirebaseNotificationService,
        private readonly mailService: MailService,
    ) {}

    @WebSocketServer()
    server: Server;

    afterInit(server: Server) {
        this.logger.log(
            "Socket.IO server initialized for Notification Gateway",
            server.adapter.name,
        );
    }

    async handleConnection(client: Socket) {
        try {
            const token = this.extractTokenFromSocket(client);
            if (!token) return client.disconnect(true);

            const payload = this.jwtService.verify<JWTPayload>(token, {
                secret: this.configService.getOrThrow("JWT_SECRET"),
            });

            if (!payload.sub) return client.disconnect(true);

            const user = await this.prisma.user.findUnique({
                where: { id: payload.sub },
                include: {
                    notificationToggles: true,
                },
            });

            if (!user) return client.disconnect(true);

            // --------------------- Ensure the user has a NotificationToggle record ---------------------
            if (!user.notificationToggles?.length) {
                await this.prisma.notificationToggle.create({
                    data: { userId: user.id },
                });

                user.notificationToggles = await this.prisma.notificationToggle.findMany({
                    where: { userId: user.id },
                });
            }

            const toggle = user.notificationToggles[0];

            const payloadForSocketClient: PayloadForSocketClient = {
                sub: user.id,
                email: user.email,
                userUpdates: toggle?.userUpdates || false,
                Service: toggle?.serviceCreate || false,
                review: toggle?.review || false,
                post: toggle?.post || false,
                message: toggle?.message || false,
                userRegistration: toggle?.userRegistration || false,
                Inquiry: toggle?.Inquiry || false,
                follow: toggle?.follow || false,
                UploadProof: toggle?.UploadProof || false,
                PaymentReminder: toggle?.PaymentReminder || false,
            };

            client.data.user = payloadForSocketClient;
            this.subscribeClient(user.id, client);

            this.logger.log(`Client connected: ${user.id}`);
        } catch (err: any) {
            this.logger.warn(`JWT verification failed: ${err.message}`);
            client.disconnect(true);
        }
    }

    handleDisconnect(client: Socket) {
        const userId = client.data?.user?.sub;
        if (userId) {
            this.unsubscribeClient(userId, client);
            this.logger.log(`Client disconnected: ${userId}`);
        } else {
            this.logger.log("Client disconnected: unknown user");
        }
    }

    private extractTokenFromSocket(client: Socket): string | null {
        const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;
        if (!authHeader) return null;
        return authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : authHeader;
    }

    private subscribeClient(userId: string, client: Socket) {
        if (!this.clients.has(userId)) this.clients.set(userId, new Set());
        this.clients.get(userId)!.add(client);
        this.logger.debug(`Subscribed client to user ${userId}`);
    }

    private unsubscribeClient(userId: string, client: Socket) {
        const set = this.clients.get(userId);
        if (!set) return;

        set.delete(client);
        this.logger.debug(`Unsubscribed client from user ${userId}`);
        if (set.size === 0) this.clients.delete(userId);
    }

    public getClientsForUser(userId: string): Set<Socket> {
        return this.clients.get(userId) || new Set();
    }

    public async notifySingleUser(userId: string, event: string, data: Notification) {
        const clients = this.getClientsForUser(userId);
        if (clients.size === 0) return;
        clients.forEach((client) => client.emit(event, data));
    }

    public async notifyMultipleUsers(userIds: string[], event: string, data: Notification) {
        userIds.forEach((userId) => this.notifySingleUser(userId, event, data));
    }

    public async notifyAllUsers(event: string, data: Notification) {
        this.clients.forEach((clients) => clients.forEach((client) => client.emit(event, data)));
    }

    @SubscribeMessage("ping")
    handlePing(client: Socket) {
        client.emit("pong");
    }

    @SubscribeMessage(EVENT_TYPES.USERREGISTRATION_CREATE)
    handlePostUpdate(purpose: string, client: Socket) {
        client.broadcast.emit(purpose, {});
    }

    // ------LISTEN TO USER REGISTRATION EVENT----------------
    @OnEvent(EVENT_TYPES.USERREGISTRATION_CREATE)
    async handleUserRegistrationCreated(payload: UserRegistration) {
        this.logger.log("User Registration EVENT RECEIVED");
        this.logger.log(`Payload: ${JSON.stringify(payload, null, 2)}`);

        if (!payload.info?.recipients?.length) {
            this.logger.warn("No recipients found → skipping");
            return;
        }

        this.logger.log(`Total recipients: ${payload.info.recipients.length}`);

        // ----------------------Check if user has notification toggle enabled ----------------
        const enabledRecipients = await this.prisma.notificationToggle.findMany({
            where: {
                userId: { in: payload.info.recipients.map((r) => r.id) },
                userRegistration: true,
            },
            select: { userId: true },
        });

        const enabledUserIds = new Set(enabledRecipients.map((r) => r.userId));

        for (const recipient of payload.info.recipients) {
            // ------------------- if user has disabled this notification type -------------------
            if (!enabledUserIds.has(recipient.id)) {
                this.logger.log(`User ${recipient.id} has disabled userRegistration notifications`);
                continue;
            }

            this.logger.log(`--- Processing recipient: ${recipient.id} (${recipient.email}) ---`);

            const notificationData: Notification = {
                type: EVENT_TYPES.USERREGISTRATION_CREATE,
                title: "New User Registered",
                message: `${payload.info.name} has registered as ${payload.info.role}`,
                createdAt: new Date(),
                meta: {
                    id: payload.info.id,
                    email: payload.info.email,
                    name: payload.info.name,
                    role: payload.info.role,
                    ...payload.meta,
                },
            };

            //  ------------ SAVE TO DATABASE ----------------
            const notification = await this.prisma.notification.create({
                data: {
                    userId: recipient.id,
                    title: notificationData.title,
                    message: notificationData.message,
                    metadata: {
                        type: notificationData.type,
                        ...notificationData.meta,
                    },
                    read: false,
                    createdAt: new Date(),
                },
            });

            //  -------------------  SAVE TO USER NOTIFICATION (Mapping) -------------------
            await this.prisma.userNotification.create({
                data: {
                    userId: recipient.id,
                    notificationId: notification.id,
                    type: "UserRegistration",
                    read: false,
                },
            });

            // -----------------  Send real-time notification via socket -----------------
            const clients = this.getClientsForUser(recipient.id);
            this.logger.log(`  → Connected sockets: ${clients.size}`);

            for (const client of clients) {
                this.logger.log(`  Sending notification to socket ${client.id}`);
                client.emit(EVENT_TYPES.USERREGISTRATION_CREATE, notificationData);
                this.logger.log(`  ✔ Notification sent to ${recipient.id} via socket ${client.id}`);
            }
        }

        this.logger.log("USERREGISTRATION_CREATE event processing complete");
    }

    // ------LISTEN TO SERVICE CREATE EVENT----------------
    @OnEvent(EVENT_TYPES.SERVICE_CREATE)
    async handleServiceCreated(payload: ServiceEvent) {
        this.logger.log("SERVICE_CREATE EVENT RECEIVED");
        this.logger.debug(JSON.stringify(payload, null, 2));

        if (!payload.info?.recipients?.length) {
            this.logger.warn("No recipients found for SERVICE_CREATE");
            return;
        }

        //----------------Check if user has notification toggle enabled -----------------------
        const enabledRecipients = await this.prisma.notificationToggle.findMany({
            where: {
                userId: { in: payload.info.recipients.map((r) => r.id) },
            },
            select: { userId: true },
        });

        const enabledUserIds = new Set(enabledRecipients.map((r) => r.userId));

        for (const recipient of payload.info.recipients) {
            // ------------ Skip if user has disabled this notification type---------------------
            if (!enabledUserIds.has(recipient.id)) {
                this.logger.log(`User ${recipient.id} has disabled serviceCreate notifications`);
                continue;
            }

            const clients = this.getClientsForUser(recipient.id);

            if (!clients.size) {
                this.logger.warn(`No active socket for user ${recipient.id}`);
            }

            const socketPayload: Notification = {
                type: EVENT_TYPES.SERVICE_CREATE,
                title: "New Service Created",
                message: `${payload.info.serviceName} has been created.`,
                createdAt: new Date(),
                meta: {
                    ...payload.meta,
                    serviceName: payload.info.serviceName,
                    userId: payload.info.authorId,
                },
            };

            // ------------------- Send real-time notification via socket -----------------------
            for (const client of clients) {
                client.emit(EVENT_TYPES.SERVICE_CREATE, socketPayload);
                this.logger.log(`Notification sent to ${recipient.id} (socket: ${client.id})`);
            }
        }
    }

    // ------ LISTEN TO INQUIRY CREATE EVENT ----------------
    @OnEvent(EVENT_TYPES.INQUIRY_CREATE)
    async handleInquiryCreated(payload: any) {
        this.logger.log("INQUIRY_CREATE EVENT RECEIVED");
        this.logger.debug(JSON.stringify(payload, null, 2));

        if (!payload.info?.recipients?.length) {
            this.logger.warn("No recipients found for INQUIRY_CREATE");
            return;
        }

        try {
            // ------------- Find users who enabled Inquiry notifications -------------
            const enabledRecipients = await this.prisma.notificationToggle.findMany({
                where: {
                    userId: { in: payload.info.recipients.map((r: any) => r.id) },
                    Inquiry: true,
                },
                select: { userId: true },
            });

            const enabledUserIds = new Set(enabledRecipients.map((r) => r.userId));

            for (const recipient of payload.info.recipients) {
                if (!enabledUserIds.has(recipient.id)) {
                    this.logger.log(`User ${recipient.id} disabled Inquiry notifications`);
                    continue;
                }

                const notificationData = {
                    type: EVENT_TYPES.INQUIRY_CREATE,
                    title: "New Inquiry Received",
                    message:
                        payload.info.message ||
                        ` like your profile and I wanna buy your service created by ${payload.info.username}`,
                    createdAt: new Date(),
                    meta: {
                        inquirerId: payload.info.id,
                        inquirerEmail: payload.info.email,
                        inquirerName: payload.info.name,
                        inquirerRole: payload.info.role,

                        ...payload.meta,
                    },
                };

                // ------------- SAVE TO DATABASE ----------------
                const notification = await this.prisma.notification.create({
                    data: {
                        userId: recipient.id,
                        title: notificationData.title,
                        message: notificationData.message,
                        metadata: {
                            type: notificationData.type,
                            ...notificationData.meta,
                        },
                        read: false,
                        createdAt: new Date(),
                    },
                });

                // ------------ SAVE TO USER NOTIFICATION (Mapping) ------------
                await this.prisma.userNotification.create({
                    data: {
                        userId: recipient.id,
                        notificationId: notification.id,
                        type: "Inquiry",
                        read: false,
                    },
                });

                this.logger.log(`Notification saved for user ${recipient.id}`);

                // ------------- SEND REALTIME VIA SOCKET -------------
                const clients = this.getClientsForUser(recipient.id);

                if (!clients.size) {
                    this.logger.warn(`No active socket for user ${recipient.id}`);
                }

                for (const client of clients) {
                    client.emit(EVENT_TYPES.INQUIRY_CREATE, notificationData);
                    this.logger.log(
                        `Realtime Inquiry notification sent to ${recipient.id} (socket: ${client.id})`,
                    );
                }
            }

            this.logger.log("INQUIRY_CREATE event processing complete");
        } catch (error: any) {
            this.logger.error(`Error processing INQUIRY_CREATE event: ${error.message}`);
        }
    }

    // ------ LISTEN TO SERVICE REQUEST ACCEPTED EVENT ----------------
    @OnEvent(EVENT_TYPES.SERVICE_REQUEST_ACCEPTED)
    async handleServiceRequestAccepted(payload: any) {
        this.logger.log("SERVICE_REQUEST_ACCEPTED EVENT RECEIVED");
        this.logger.debug(JSON.stringify(payload, null, 2));

        if (!payload.info) {
            this.logger.warn("No info found for SERVICE_REQUEST_ACCEPTED");
            return;
        }

        try {
            const buyerId = payload.info.buyerId;
            const notificationData = {
                type: EVENT_TYPES.SERVICE_REQUEST_ACCEPTED,
                title: " Service Request Accepted",
                message: `${payload.info.sellerName} has accepted your service request for "${payload.info.serviceName}"`,
                createdAt: new Date(),
                meta: {
                    serviceRequestId: payload.info.serviceRequestId,
                    serviceId: payload.info.serviceId,
                    serviceName: payload.info.serviceName,
                    sellerId: payload.info.sellerId,
                    sellerName: payload.info.sellerName,
                    status: "ACCEPTED",
                    ...payload.meta,
                },
            };

            // ------------- SAVE TO DATABASE ----------------
            const notification = await this.prisma.notification.create({
                data: {
                    userId: buyerId,
                    title: notificationData.title,
                    message: notificationData.message,
                    metadata: {
                        type: notificationData.type,
                        ...notificationData.meta,
                    },
                    read: false,
                    createdAt: new Date(),
                },
            });

            // ------------ SAVE TO USER NOTIFICATION (Mapping) ------------
            await this.prisma.userNotification.create({
                data: {
                    userId: buyerId,
                    notificationId: notification.id,
                    type: "Service",
                    read: false,
                },
            });

            this.logger.log(`Notification saved for buyer ${buyerId}`);

            // ------------- SEND EMAIL NOTIFICATION ----------------
            // try {
            //     const buyer = await this.prisma.user.findUnique({
            //         where: { id: buyerId },
            //         select: { email: true, full_name: true },
            //     });

            //     if (buyer?.email) {
            //         await this.mailService.sendEmail(
            //             buyer.email,
            //             "Service Request Accepted",
            //             `
            //             <p>Hello ${buyer.full_name || "Buyer"},</p>
            //             <p><strong>${payload.info.sellerName}</strong> has accepted your service request for <strong>"${payload.info.serviceName}"</strong>.</p>
            //             <p>You can now proceed with the next steps of your request.</p>
            //             <p>Thank you,<br/>DaConnect Team</p>
            //             `,
            //         );
            //         this.logger.log(` Email notification sent to buyer ${buyerId}`);
            //     }
            // } catch (emailError: any) {
            //     this.logger.error(`Failed to send email notification: ${emailError.message}`);
            // }

            // ------------- SEND FIREBASE NOTIFICATION ----------------
            // try {
            //     await this.firebaseNotificationService.sendToUser(
            //         buyerId,
            //         {
            //             title: " Service Request Accepted",
            //             body: `${payload.info.sellerName} has accepted your service request for "${payload.info.serviceName}"`,
            //             type: NotificationType.SERVICE_REQUEST,
            //             data: {
            //                 serviceRequestId: payload.info.serviceRequestId,
            //                 sellerId: payload.info.sellerId,
            //                 sellerName: payload.info.sellerName,
            //                 serviceName: payload.info.serviceName,
            //                 status: "ACCEPTED",
            //                 timestamp: new Date().toISOString(),
            //             },
            //         },
            //         false,
            //     );
            //     this.logger.log(` Firebase notification sent to buyer ${buyerId}`);
            // } catch (fbError: any) {
            //     this.logger.error(`Failed to send Firebase notification: ${fbError.message}`);
            // }

            // ------------- SEND REALTIME VIA SOCKET -------------
            const clients = this.getClientsForUser(buyerId);

            if (!clients.size) {
                this.logger.warn(`No active socket for buyer ${buyerId}`);
            }

            for (const client of clients) {
                client.emit(EVENT_TYPES.SERVICE_REQUEST_ACCEPTED, notificationData);
                this.logger.log(
                    `Service Request Accepted notification sent to ${buyerId} (socket: ${client.id})`,
                );
            }

            this.logger.log("SERVICE_REQUEST_ACCEPTED event processing complete");
        } catch (error: any) {
            this.logger.error(`Error processing SERVICE_REQUEST_ACCEPTED event: ${error.message}`);
        }
    }

    // ------ LISTEN TO SERVICE REQUEST DECLINED EVENT ----------------
    @OnEvent(EVENT_TYPES.SERVICE_REQUEST_DECLINED)
    async handleServiceRequestDeclined(payload: any) {
        this.logger.log("SERVICE_REQUEST_DECLINED EVENT RECEIVED");
        this.logger.debug(JSON.stringify(payload, null, 2));

        if (!payload.info) {
            this.logger.warn("No info found for SERVICE_REQUEST_DECLINED");
            return;
        }

        try {
            const buyerId = payload.info.buyerId;
            const notificationData = {
                type: EVENT_TYPES.SERVICE_REQUEST_DECLINED,
                title: " Service Request Declined",
                message: `${payload.info.sellerName} has declined your service request for "${payload.info.serviceName}"`,
                createdAt: new Date(),
                meta: {
                    serviceRequestId: payload.info.serviceRequestId,
                    serviceId: payload.info.serviceId,
                    serviceName: payload.info.serviceName,
                    sellerId: payload.info.sellerId,
                    sellerName: payload.info.sellerName,
                    status: "DECLINED",
                    reason: payload.info.reason || undefined,
                    ...payload.meta,
                },
            };

            // ------------- SAVE TO DATABASE ----------------
            const notification = await this.prisma.notification.create({
                data: {
                    userId: buyerId,
                    title: notificationData.title,
                    message: notificationData.message,
                    metadata: {
                        type: notificationData.type,
                        ...notificationData.meta,
                    },
                    read: false,
                    createdAt: new Date(),
                },
            });

            // ------------ SAVE TO USER NOTIFICATION (Mapping) ------------
            await this.prisma.userNotification.create({
                data: {
                    userId: buyerId,
                    notificationId: notification.id,
                    type: "Service",
                    read: false,
                },
            });

            this.logger.log(`Notification saved for buyer ${buyerId}`);

            // ------------- SEND EMAIL NOTIFICATION ----------------
            // try {
            //     const buyer = await this.prisma.user.findUnique({
            //         where: { id: buyerId },
            //         select: { email: true, full_name: true },
            //     });

            //     if (buyer?.email) {
            //         const reasonText = payload.info.reason
            //             ? `<p><strong>Reason:</strong> ${payload.info.reason}</p>`
            //             : "";
            //         await this.mailService.sendEmail(
            //             buyer.email,
            //             " Service Request Declined",
            //             `
            //             <p>Hello ${buyer.full_name || "Buyer"},</p>
            //             <p><strong>${payload.info.sellerName}</strong> has declined your service request for <strong>"${payload.info.serviceName}"</strong>.</p>
            //             ${reasonText}
            //             <p>You can create a new request or contact the seller for more details.</p>
            //             <p>Thank you,<br/>DaConnect Team</p>
            //             `,
            //         );
            //         this.logger.log(` Email notification sent to buyer ${buyerId}`);
            //     }
            // } catch (emailError: any) {
            //     this.logger.error(`Failed to send email notification: ${emailError.message}`);
            // }

            // ------------- SEND FIREBASE NOTIFICATION  ----------------
            // try {
            //     await this.firebaseNotificationService.sendToUser(
            //         buyerId,
            //         {
            //             title: " Service Request Declined",
            //             body: `${payload.info.sellerName} has declined your service request for "${payload.info.serviceName}"`,
            //             type: NotificationType.SERVICE_REQUEST,
            //             data: {
            //                 serviceRequestId: payload.info.serviceRequestId,
            //                 sellerId: payload.info.sellerId,
            //                 sellerName: payload.info.sellerName,
            //                 serviceName: payload.info.serviceName,
            //                 status: "DECLINED",
            //                 reason: payload.info.reason || undefined,
            //                 timestamp: new Date().toISOString(),
            //             },
            //         },
            //         false,
            //     );
            //     this.logger.log(` Firebase notification sent to buyer ${buyerId}`);
            // } catch (fbError: any) {
            //     this.logger.error(`Failed to send Firebase notification: ${fbError.message}`);
            // }

            // ------------- SEND REALTIME VIA SOCKET -------------
            const clients = this.getClientsForUser(buyerId);

            if (!clients.size) {
                this.logger.warn(`No active socket for buyer ${buyerId}`);
            }

            for (const client of clients) {
                client.emit(EVENT_TYPES.SERVICE_REQUEST_DECLINED, notificationData);
                this.logger.log(
                    `Service Request Declined notification sent to ${buyerId} (socket: ${client.id})`,
                );
            }

            this.logger.log("SERVICE_REQUEST_DECLINED event processing complete");
        } catch (error: any) {
            this.logger.error(`Error processing SERVICE_REQUEST_DECLINED event: ${error.message}`);
        }
    }
}
