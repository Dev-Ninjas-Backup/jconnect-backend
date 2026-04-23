import { HttpException, Injectable } from "@nestjs/common";
import { PrismaService } from "src/lib/prisma/prisma.service";

import { HandleError } from "@common/error/handle-error.decorator";
import { AwsService } from "@main/aws/aws.service";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { EVENT_TYPES } from "@main/shared/notification/interface/events.name";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";

@Injectable()
export class ServiceRequestService {
    constructor(
        private prisma: PrismaService,
        private awsService: AwsService,
        private readonly firebaseNotificationService: FirebaseNotificationService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    async create(dto: CreateServiceRequestDto, files: Express.Multer.File[], user: any) {
        // -------------------------------
        // 1️⃣ Validate serviceId exists
        // -------------------------------
        if (!dto.serviceId) {
            throw new HttpException("serviceId is required", 400);
        }

        const service = await this.prisma.service.findUnique({
            where: { id: dto.serviceId },
        });

        if (!service) {
            throw new HttpException("Service not found with the given ID", 404);
        }

        // -------------------------------
        // 2️⃣ Handle file uploads
        // -------------------------------
        let uploadedUrls: string[] = [];
        if (files && files.length > 0) {
            uploadedUrls = await Promise.all(
                files.map(async (file) => {
                    const result = await this.awsService.upload(file);
                    return result.url;
                }),
            );
        } else {
            uploadedUrls = ["no file"];
        }

        // console.log("amar url ", uploadedUrls);

        // -------------------------------
        // 3️⃣ Create serviceRequest
        // -------------------------------
        try {
            const serviceRequest = await this.prisma.serviceRequest.create({
                data: {
                    serviceId: service.id,
                    buyerId: user.userId,
                    captionOrInstructions: dto.captionOrInstructions || null,
                    promotionDate: dto.promotionDate || null,
                    specialNotes: dto.specialNotes || null,
                    price: dto.price || null,
                    uploadedFileUrl: uploadedUrls,
                    messageID: dto.messageID || "",
                },
            });

            return {
                message: "Service request created successfully",
                serviceRequest,
            };
        } catch (error) {
            console.error("Error creating serviceRequest:", error);

            // Prisma foreign key error
            if (error.code === "P2003") {
                throw new HttpException(
                    "Foreign key constraint failed: invalid serviceId or buyerId",
                    400,
                );
            }

            throw new HttpException("Failed to create service request", 500);
        }
    }

    async findAll() {
        return this.prisma.serviceRequest.findMany({
            include: {
                service: { include: { creator: { omit: { password: true } } } },
                buyer: { omit: { password: true } },
            },
        });
    }

    async testAWSConnection() {
        return this.awsService.testConnection();
    }

    async findOne(id: string) {
        return this.prisma.serviceRequest.findUnique({
            where: { id },
            include: {
                service: { include: { creator: { omit: { password: true } } } },
                buyer: { omit: { password: true } },
            },
        });
    }

    async updateIsPaid(id: string, isPaid: boolean) {
        const serviceRequest = await this.prisma.serviceRequest.findUnique({
            where: { id },
        });

        if (!serviceRequest) {
            throw new HttpException("Service request not found", 404);
        }

        return this.prisma.serviceRequest.update({
            where: { id },
            data: { isPaid },
            include: {
                service: { include: { creator: { omit: { password: true } } } },
                buyer: { omit: { password: true } },
            },
        });
    }

    // ------------ decline or accept service request-----------------
    @HandleError("Failed to update service request status")
    async updateIsDeclined(id: string, updateData: { isDeclined?: boolean; isAccepted?: boolean }) {
        const serviceRequest = await this.prisma.serviceRequest.findUnique({
            where: { id },
            include: {
                service: {
                    include: {
                        creator: {
                            select: {
                                id: true,
                                full_name: true,
                                username: true,
                            },
                        },
                    },
                },
                buyer: {
                    select: {
                        id: true,
                        full_name: true,
                    },
                },
            },
        });

        if (!serviceRequest) {
            throw new HttpException("Service request not found", 404);
        }

        if (Object.keys(updateData).length === 0) {
            throw new HttpException(
                "At least one field (isDeclined or isAccepted) must be provided",
                400,
            );
        }

        const updated = await this.prisma.serviceRequest.update({
            where: { id },
            data: updateData,
            include: {
                service: { include: { creator: { omit: { password: true } } } },
                buyer: { omit: { password: true } },
            },
        });

        // Send notification to buyer when seller accepts or declines the service request
        try {
            if (serviceRequest.service && serviceRequest.service.creator) {
                const sellerName =
                    serviceRequest.service.creator.username ||
                    serviceRequest.service.creator.full_name ||
                    "Seller";
                const serviceName = serviceRequest.service.serviceName || "Your service request";

                if (updateData.isAccepted === true) {
                    // Send acceptance notification to buyer
                    await this.firebaseNotificationService.sendToUser(
                        serviceRequest.buyerId,
                        {
                            title: "✅ Service Request Accepted",
                            body: `${sellerName} has accepted your service request for "${serviceName}"`,
                            type: NotificationType.SERVICE_REQUEST,
                            data: {
                                serviceRequestId: id,
                                sellerId: serviceRequest.service.creator.id,
                                sellerName,
                                serviceName,
                                status: "ACCEPTED",
                                timestamp: new Date().toISOString(),
                            },
                        },
                        true,
                    );
                    console.log(
                        `✅ Acceptance notification sent to buyer ${serviceRequest.buyerId}`,
                    );

                    // Emit event for websocket listeners
                    this.eventEmitter.emit(EVENT_TYPES.SERVICE_REQUEST_ACCEPTED, {
                        info: {
                            serviceRequestId: id,
                            serviceId: serviceRequest.serviceId,
                            serviceName,
                            sellerId: serviceRequest.service.creator.id,
                            sellerName,
                            buyerId: serviceRequest.buyerId,
                            status: "ACCEPTED",
                            actionAt: new Date(),
                        },
                    });
                }

                if (updateData.isDeclined === true) {
                    // Send decline notification to buyer
                    await this.firebaseNotificationService.sendToUser(
                        serviceRequest.buyerId,
                        {
                            title: "❌ Service Request Declined",
                            body: `${sellerName} has declined your service request for "${serviceName}"`,
                            type: NotificationType.SERVICE_REQUEST,
                            data: {
                                serviceRequestId: id,
                                sellerId: serviceRequest.service.creator.id,
                                sellerName,
                                serviceName,
                                status: "DECLINED",
                                timestamp: new Date().toISOString(),
                            },
                        },
                        true,
                    );
                    console.log(`❌ Decline notification sent to buyer ${serviceRequest.buyerId}`);

                    // Emit event for websocket listeners
                    this.eventEmitter.emit(EVENT_TYPES.SERVICE_REQUEST_DECLINED, {
                        info: {
                            serviceRequestId: id,
                            serviceId: serviceRequest.serviceId,
                            serviceName,
                            sellerId: serviceRequest.service.creator.id,
                            sellerName,
                            buyerId: serviceRequest.buyerId,
                            status: "DECLINED",
                            actionAt: new Date(),
                        },
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to send notification: ${error.message}`);
            // Continue execution even if notification fails
        }

        return updated;
    }

    async updateUploadedFiles(id: string, files: Express.Multer.File[], user: any) {
        // 1️⃣ Find the service request
        const serviceRequest = await this.prisma.serviceRequest.findUnique({
            where: { id },
        });

        if (!serviceRequest) {
            throw new HttpException("Service request not found", 404);
        }

        // 2️⃣ Verify the user is the buyer
        if (serviceRequest.buyerId !== user.userId) {
            throw new HttpException("You are not authorized to update this service request", 403);
        }

        // 3️⃣ Delete old files from S3 (if they exist)
        if (serviceRequest.uploadedFileUrl && serviceRequest.uploadedFileUrl.length > 0) {
            for (const fileUrl of serviceRequest.uploadedFileUrl) {
                if (fileUrl !== "no file") {
                    await this.awsService.deleteFile(fileUrl);
                }
            }
        }

        // 4️⃣ Upload new files
        let uploadedUrls: string[] = [];
        if (files && files.length > 0) {
            uploadedUrls = await Promise.all(
                files.map(async (file) => {
                    const result = await this.awsService.upload(file);
                    return result.url;
                }),
            );
        } else {
            uploadedUrls = ["no file"];
        }

        // 5️⃣ Update the service request with new files and reset isDeclined to false
        return this.prisma.serviceRequest.update({
            where: { id },
            data: {
                uploadedFileUrl: uploadedUrls,
                isDeclined: false,
                isAccepted: false,
            },
            include: {
                service: { include: { creator: { omit: { password: true } } } },
                buyer: { omit: { password: true } },
            },
        });
    }
}
