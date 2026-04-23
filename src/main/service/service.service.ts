import { HandleError } from "@common/error/handle-error.decorator";
import { errorResponse } from "@common/utilsResponse/response.util";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { ServiceEvent } from "@main/shared/notification/interface/events-payload";
import { EVENT_TYPES } from "@main/shared/notification/interface/events.name";
import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { PrismaService } from "src/lib/prisma/prisma.service";
import Stripe from "stripe";
import { CreateServiceDto } from "./dto/create-service.dto";
import { UpdateServiceDto } from "./dto/update-service.dto";
@Injectable()
export class ServiceService {
    constructor(
        private prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
        private readonly firebaseNotificationService: FirebaseNotificationService,
        @Inject("STRIPE_CLIENT") private stripe: Stripe,
    ) {}

    // ------------------- Create new service-------------------//
    @HandleError("Failed to create service")
    async create(dto: CreateServiceDto, user: any): Promise<any> {
        if (!user.userId) return errorResponse("User ID is missing");

        const currentUser = await this.prisma.user.findUnique({
            where: { id: user.userId },
            select: {
                username: true,
                full_name: true,
                email: true,
            },
        });

        const creatorDisplayName =
            currentUser?.username ||
            currentUser?.full_name ||
            user.username ||
            user.full_name ||
            currentUser?.email ||
            user.email ||
            "A user";

        // ------------------ Check if service already exists ------------------
        const existingService = await this.prisma.service.findFirst({
            where: { serviceName: dto.serviceName, creatorId: user.userId },
        });
        if (existingService) return errorResponse("Service already exists");

        //  ------------------  Create new service ------------------
        const service = await this.prisma.service.create({
            data: {
                ...dto,
                creatorId: user.userId,
            },
        });

        // -----------------------------------------
        //  ------------  Get users who enabled SERVICE notifications ONLY FOLLOWER can send notifications ------------
        // -----------------------------------------
        const recipients = await this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                fcmToken: true,
                username: true,
            },
            where: {
                follwers: {
                    some: {
                        followerId: user.userId,
                    },
                },
            },
        });

        // -----------------------------------------
        //  ----------------- Create Notification entry -----------------
        // -----------------------------------------
        const notification = await this.prisma.notification.create({
            data: {
                title: `New Service Created: ${service.serviceName}`,
                message: `New Service Created: ${service.serviceName} by ${creatorDisplayName}`,
                userId: user.userId,
                entityId: service.id,
                metadata: {
                    serviceId: service.id,
                    serviceName: service.serviceName,
                    description: service.description,
                    author: currentUser?.email || user.email,
                    creatorId: user.userId,
                    recipients: recipients.map((r) => ({
                        id: r.id,
                        email: r.email,
                    })),
                },
            },
        });

        await this.prisma.$transaction(
            recipients.map((r) =>
                this.prisma.userNotification.create({
                    data: {
                        userId: r.id,
                        notificationId: notification.id,
                    },
                }),
            ),
        );

        // -----------------------------------------
        // --------------  Emit Service Event --------------
        // -----------------------------------------
        const payload: ServiceEvent = {
            action: "CREATE",
            meta: {
                serviceName: service.serviceName,
                description: service.description || "",
                authorId: user.userId,
                publishedAt: new Date(),
            },
            info: {
                serviceName: service.serviceName,
                description: service.description || "",
                authorId: user.userId,
                publishedAt: new Date(),
                recipients: recipients.map((r) => ({
                    id: r.id,
                    email: r.email,
                })),
            },
        };

        this.eventEmitter.emit(EVENT_TYPES.SERVICE_CREATE, payload);

        // -----------------------------------------
        //  -------------------- Send Firebase Push Notifications --------------------
        // -----------------------------------------
        await this.firebaseNotificationService.sendToMultipleUsers(
            recipients.map((r) => r.id),
            {
                title: `New Service: ${service.serviceName}`,
                body: `${creatorDisplayName} created a new service. Check it out!`,
                type: NotificationType.ANNOUNCEMENT,
                data: {
                    serviceId: service.id,
                    serviceName: service.serviceName,
                    userId: user.userId,
                },
            },
        );

        return { message: "Service created successfully", service };
    }

    //------------------- Get all non-custom services-------------------//
    @HandleError("Failed to find service")
    async findAll() {
        return this.prisma.service.findMany({
            where: { isCustom: false },
            include: {
                creator: {
                    select: {
                        sellerIDStripe: true,
                        email: true,
                        full_name: true,
                        username: true,
                    },
                },
                serviceRequests: true,
            },
        });
    }

    //------------------- Get services created by the authenticated user-------------------//
    @HandleError("Failed to find service")
    async Myservice(user: any) {
        return this.prisma.service.findMany({
            where: { creatorId: user.userId },
            include: {
                creator: {
                    select: {
                        sellerIDStripe: true,
                        email: true,
                        full_name: true,
                        username: true,
                    },
                },
                serviceRequests: true,
            },
        });
    }

    //------------------- Get service by ID-------------------//
    @HandleError("Failed to find service")
    async findOne(id: string) {
        let service: any = await this.prisma.service.findUnique({
            where: { id },
            include: {
                creator: {
                    select: {
                        sellerIDStripe: true,
                        email: true,
                        full_name: true,
                        username: true,
                    },
                },
            },
        });

        const setting = await this.prisma.setting.findFirst();

        service = {
            ...service,
            platformFee_percents: setting?.platformFee_percents || 0,
        };

        if (!service) {
            throw new NotFoundException(`Service with ID ${id} not found`);
        }
        return service;
    }

    //------------------- Update service-------------------//
    @HandleError("Failed to update service")
    async update(id: string, dto: UpdateServiceDto, user: any): Promise<any> {
        if (!user.userId) return errorResponse("User ID is missing");

        // ---------------- Check if service exists ----------------
        const service = await this.prisma.service.findUnique({
            where: { id },
        });

        if (!service) return errorResponse("Service not found");

        // ----------------------  Check ownership ----------------------
        if (service.creatorId !== user.userId)
            return errorResponse("You are not allowed to update this service");

        //  ------------------  Update service ------------------
        const updatedService = await this.prisma.service.update({
            where: { id },
            data: {
                ...dto,
            },
        });

        const recipients = await this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                fcmToken: true,
                username: true,
            },
            where: {
                follwers: {
                    some: {
                        followerId: user.userId,
                    },
                },
            },
        });

        // ----------------------  Emit Service Event ----------------------
        const payload: ServiceEvent = {
            action: "UPDATE",
            meta: {
                serviceName: updatedService.serviceName,
                description: updatedService.description || "",
                authorId: user.userId,
                publishedAt: new Date(),
            },
            info: {
                serviceName: updatedService.serviceName,
                description: updatedService.description || "",
                authorId: user.userId,
                publishedAt: new Date(),
                recipients: recipients.map((r) => ({
                    id: r.id,
                    email: r.email,
                })),
            },
        };

        this.eventEmitter.emit(EVENT_TYPES.SERVICE_CREATE, payload);

        // ------------------ send firebase notifications to followers ------------------
        await this.firebaseNotificationService.sendToMultipleUsers(
            recipients.map((r) => r.id),
            {
                title: `Service Updated: ${updatedService.serviceName}`,
                body: `${service.serviceName} has been updated. Check out the new details!`,
                type: NotificationType.SERVICE_UPDATE,
                data: {
                    serviceId: updatedService.id,
                    serviceName: updatedService.serviceName,
                    userId: user.userId,
                },
            },
        );
        console.log(" Service update notification sent to followers of user", user.userId);

        return {
            message: "Service updated successfully",
            service: updatedService,
        };
    }

    @HandleError("Failed to delete service")
    async remove(id: string) {
        return this.prisma.service.delete({
            where: { id },
        });
    }
}
