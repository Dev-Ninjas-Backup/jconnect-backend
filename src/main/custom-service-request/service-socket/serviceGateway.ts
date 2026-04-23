import { Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    WebSocketGateway,
    WebSocketServer,
} from "@nestjs/websockets";

import * as jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { ENVEnum } from "src/common/enum/env.enum";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { CustomServiceRequestService } from "../custom-service-request.service";

enum ServiceEvents {
    ERROR = "service:error",
    SUCCESS = "service:success",
    GET_SERVICE_REQUESTS = "service:get_service_requests",

    // REST API Real-time Events
    SERVICE_CREATED = "service:created",
    SERVICE_UPDATED = "service:updated",
    SERVICE_DELETED = "service:deleted",
    SERVICE_LIST_UPDATED = "service:list_updated",
}

@WebSocketGateway({
    cors: { origin: "*" },
    namespace: "/service",
})
export class serviceGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(serviceGateway.name);

    constructor(
        private readonly customServiceRequestService: CustomServiceRequestService,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
    ) {}

    @WebSocketServer()
    server: Server;

    afterInit(server: Server) {
        this.logger.log("server initialized FOR serviceGateway", server.adapter.name);
    }

    /** Handle socket connection and authentication */
    async handleConnection(client: Socket) {
        const authHeader = client.handshake.headers.authorization || client.handshake.auth?.token;
        if (!authHeader) {
            client.emit(ServiceEvents.ERROR, {
                message: "Missing authorization header",
            });
            client.disconnect(true);
            this.logger.warn("Missing auth header");
            return;
        }

        const token = authHeader.split(" ")[1];
        console.log("the connected token is", token);
        if (!token) {
            client.emit(ServiceEvents.ERROR, { message: "Missing token" });
            client.disconnect(true);
            this.logger.warn("Missing token");
            return;
        }

        try {
            const jwtSecret = this.configService.get<string>(ENVEnum.JWT_SECRET);
            const payload: any = jwt.verify(token, jwtSecret as string);
            const userId = payload.sub;

            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true, email: true },
            });
            if (!user) {
                client.emit(ServiceEvents.ERROR, {
                    message: "User not found in database",
                });
                client.disconnect(true);
                this.logger.warn(`User not found: ${userId}`);
                return;
            }

            client.data.userId = userId;
            client.join(userId);
            client.emit(ServiceEvents.SUCCESS, userId);
            this.logger.log(` serviceGateway: User ${userId} connected, socket ${client.id}`);
        } catch (err) {
            client.emit(ServiceEvents.ERROR, { message: err.message });
            client.disconnect(true);
            this.logger.warn(`Authentication failed: ${err.message}`);
        }
    }

    handleDisconnect(client: Socket) {
        client.leave(client.data.userId);
        client.emit(ServiceEvents.ERROR, { message: "Disconnected" });
        this.logger.log(`Private chat disconnected: ${client.id}`);
    }

    // Real-time event emitters for REST API operations

    /**
     * Emit event when a new custom service request is created
     * Called by REST API controller after creating a request
     */
    emitServiceCreated(serviceRequest: any) {
        try {
            // Emit to the buyer who created the request
            if (serviceRequest.buyerId) {
                this.server.to(serviceRequest.buyerId).emit(ServiceEvents.SERVICE_CREATED, {
                    event: "created",
                    data: serviceRequest,
                    timestamp: new Date().toISOString(),
                });
            }

            // Emit to the target creator if specified
            if (serviceRequest.targetCreatorId) {
                this.server.to(serviceRequest.targetCreatorId).emit(ServiceEvents.SERVICE_CREATED, {
                    event: "created",
                    data: serviceRequest,
                    timestamp: new Date().toISOString(),
                });
            }

            // Broadcast to all connected clients for list updates
            this.server.emit(ServiceEvents.SERVICE_LIST_UPDATED, {
                action: "created",
                data: serviceRequest,
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`Service request created event emitted: ${serviceRequest.id}`);
        } catch (error) {
            this.logger.error(`Error emitting service created event: ${error.message}`);
        }
    }

    /**
     * Emit event when a custom service request is updated
   
     */
    emitServiceUpdated(serviceRequest: any) {
        try {
            // Emit to the buyer
            if (serviceRequest.buyerId) {
                this.server.to(serviceRequest.buyerId).emit(ServiceEvents.SERVICE_UPDATED, {
                    event: "updated",
                    data: serviceRequest,
                    timestamp: new Date().toISOString(),
                });
            }

            // Emit to the target creator if specified
            if (serviceRequest.targetCreatorId) {
                this.server.to(serviceRequest.targetCreatorId).emit(ServiceEvents.SERVICE_UPDATED, {
                    event: "updated",
                    data: serviceRequest,
                    timestamp: new Date().toISOString(),
                });
            }

            // Broadcast to all connected clients for list updates
            this.server.emit(ServiceEvents.SERVICE_LIST_UPDATED, {
                action: "updated",
                data: serviceRequest,
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`Service request updated event emitted: ${serviceRequest.id}`);
        } catch (error) {
            this.logger.error(`Error emitting service updated event: ${error.message}`);
        }
    }

    /**
     * Emit event when a custom service request is deleted
   
     */
    emitServiceDeleted(serviceRequest: any) {
        try {
            // Emit to the buyer
            if (serviceRequest.buyerId) {
                this.server.to(serviceRequest.buyerId).emit(ServiceEvents.SERVICE_DELETED, {
                    event: "deleted",
                    data: serviceRequest,
                    timestamp: new Date().toISOString(),
                });
            }

            // Emit to the target creator if specified
            if (serviceRequest.targetCreatorId) {
                this.server.to(serviceRequest.targetCreatorId).emit(ServiceEvents.SERVICE_DELETED, {
                    event: "deleted",
                    data: serviceRequest,
                    timestamp: new Date().toISOString(),
                });
            }

            // Broadcast to all connected clients for list updates
            this.server.emit(ServiceEvents.SERVICE_LIST_UPDATED, {
                action: "deleted",
                data: { id: serviceRequest.id },
                timestamp: new Date().toISOString(),
            });

            this.logger.log(`Service request deleted event emitted: ${serviceRequest.id}`);
        } catch (error) {
            this.logger.error(`Error emitting service deleted event: ${error.message}`);
        }
    }

    /**
     * Emit event when service requests list is fetched
     * Called by REST API controller after fetching all requests
     */
    emitServiceListFetched(userId: string | null, serviceRequests: any[]) {
        try {
            const payload = {
                event: "list_fetched",
                data: serviceRequests,
                count: serviceRequests.length,
                timestamp: new Date().toISOString(),
            };

            if (userId) {
                this.server.to(userId).emit(ServiceEvents.GET_SERVICE_REQUESTS, payload);
                this.logger.log(`Service requests list fetched event emitted to user ${userId}`);
            } else {
                this.server.emit(ServiceEvents.GET_SERVICE_REQUESTS, payload);
                this.logger.log(`Service requests list fetched event broadcasted to all clients`);
            }
        } catch (error) {
            this.logger.error(`Error emitting service list fetched event: ${error.message}`);
        }
    }

    /**
     * Broadcast error event to specific user or all users
     */
    emitError(error: any, userId?: string) {
        try {
            const payload = {
                event: "error",
                error: typeof error === "string" ? error : error.message,
                timestamp: new Date().toISOString(),
            };

            if (userId) {
                this.server.to(userId).emit(ServiceEvents.ERROR, payload);
            } else {
                this.server.emit(ServiceEvents.ERROR, payload);
            }

            this.logger.error(`Error event emitted: ${JSON.stringify(payload)}`);
        } catch (err) {
            this.logger.error(`Error emitting error event: ${err.message}`);
        }
    }
}
