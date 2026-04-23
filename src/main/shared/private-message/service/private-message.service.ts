import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { EVENT_TYPES } from "@main/shared/notification/interface/events.name";
import { HttpException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { AppError } from "src/common/error/handle-error.app";
import { HandleError } from "src/common/error/handle-error.decorator";
import { successResponse } from "src/common/utilsResponse/response.util";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { SendPrivateMessageDto } from "../dto/privateChatGateway.dto";

@Injectable()
export class PrivateChatService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly firebaseNotificationService: FirebaseNotificationService,
        private readonly eventEmitter: EventEmitter2,
    ) {}

    /**
     * Send a private message and update lastMessage in conversation
     */
    @HandleError("Failed to send private message", "PRIVATE_CHAT")
    async sendPrivateMessage(conversationId: string, senderId: string, dto: SendPrivateMessageDto) {
        console.log("🔍 Received DTO:", JSON.stringify(dto, null, 2));
        const serviceId = dto.serviceId || null;
        const serviceRequestId = dto.serviceRequestId || null;
        console.log("🔍 serviceRequestId value:", serviceRequestId);

        if (serviceId) {
            await this.prisma.service.findUniqueOrThrow({
                where: {
                    id: serviceId,
                },
            });
        }

        if (serviceRequestId) {
            const serviceRequestExists = await this.prisma.serviceRequest.findUnique({
                where: {
                    id: serviceRequestId,
                },
            });
            if (!serviceRequestExists) {
                console.log(`⚠️ ServiceRequest ${serviceRequestId} not found in database`);
                throw new NotFoundException(`ServiceRequest with ID ${serviceRequestId} not found`);
            }
        }

        const message = await this.prisma.privateMessage.create({
            data: {
                content: dto.content,
                conversationId,
                senderId,
                ...(serviceId && { serviceId }),
                ...(serviceRequestId && { serviceRequestId }),
                ...(dto.files &&
                    dto.files.length > 0 && {
                        files: dto.files,
                    }),
            },
            include: {
                sender: {
                    select: {
                        id: true,
                        profilePhoto: true,
                        full_name: true,
                        username: true,
                    },
                },
                service: true,
                serviceRequest: true,
            },
        });

        console.log("✅ Message created with serviceRequestId:", message.serviceRequestId);

        // Update last message reference in conversation
        await this.prisma.privateConversation.update({
            where: { id: conversationId },
            data: {
                lastMessageId: message.id,
                updatedAt: new Date(),
            },
        });

        // Fetch conversation to set delivery status
        const conversation = await this.prisma.privateConversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation) {
            throw new NotFoundException(`Conversation ${conversationId} not found`);
        }

        await this.prisma.privateMessageStatus.createMany({
            data: [
                {
                    messageId: message.id,
                    userId: conversation.user1Id,
                    status: "DELIVERED",
                },
                {
                    messageId: message.id,
                    userId: conversation.user2Id,
                    status: "DELIVERED",
                },
            ],
            skipDuplicates: true,
        });

        // -------------Send Firebase notification to recipient user--------------

        const recipientId =
            conversation.user1Id === senderId ? conversation.user2Id : conversation.user1Id;

        try {
            await this.firebaseNotificationService.sendToUser(
                recipientId,
                {
                    title: message.sender.username || "User new message",
                    body: dto.content || "You have a new message",
                    type: NotificationType.NEW_MESSAGE,
                    data: {
                        conversationId: conversationId,
                        messageId: message.id,
                        senderId: senderId,
                        senderName: message.sender.username || message.sender.full_name || "User",
                        userName: message.sender.username || "username",
                        timestamp: message.createdAt.toISOString(),
                    },
                },
                false,
            );
            console.log(` Firebase notification sent to user ${recipientId}`);
        } catch (error) {
            console.error(` Failed to send Firebase notification: ${error.message}`);
            throw error;
        }

        return message;
    }

    /**
     *-------------------- Load all chats ----------------------
     */
    @HandleError("Failed to get all chats with last message")
    async getAllChatsWithLastMessage(userId: string) {
        // ---------- Private chats -----------------
        const privateChats = await this.prisma.privateConversation.findMany({
            where: {
                OR: [{ user1Id: userId }, { user2Id: userId }],
            },
            include: {
                lastMessage: {
                    include: {
                        sender: {
                            select: {
                                id: true,
                                profilePhoto: true,
                                full_name: true,
                                username: true,
                            },
                        },
                    },
                },
                user1: {
                    select: {
                        id: true,
                        profilePhoto: true,
                        full_name: true,
                        username: true,
                    },
                },
                user2: {
                    select: {
                        id: true,
                        profilePhoto: true,
                        full_name: true,
                        username: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        const formattedPrivateChats = privateChats.map((chat: any) => {
            const otherUser = chat.user1Id === userId ? chat.user2 : chat.user1;
            return {
                type: "private",
                chatId: chat.id,
                participant: otherUser,
                lastMessage: chat.lastMessage
                    ? {
                          id: chat.lastMessage.id,
                          content: chat.lastMessage.content,
                          createdAt: chat.lastMessage.createdAt,
                          sender: chat.lastMessage.sender,
                          file: chat.lastMessage.file,
                      }
                    : null,
                updatedAt: chat.updatedAt,
            };
        });

        // ------------ Merge & sort-------------------
        const allChats = [...formattedPrivateChats].sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime(),
        );

        return successResponse(allChats, "Chats fetched successfully");
    }

    /**
     * Find existing conversation between two users or create one
     */
    @HandleError("Failed to find conversation", "PRIVATE_CHAT")
    async findConversation(userA: string, userB: string) {
        const [user1Id, user2Id] = [userA, userB].sort();
        return this.prisma.privateConversation.findUnique({
            where: {
                user1Id_user2Id: {
                    user1Id,
                    user2Id,
                },
            },
        });
    }

    /**
     * Create new conversation between two users
     */
    @HandleError("Failed to create conversation", "PRIVATE_CHAT")
    async createConversation(userA: string, userB: string) {
        const [user1Id, user2Id] = [userA, userB].sort();
        return this.prisma.privateConversation.create({
            data: { user1Id, user2Id },
        });
    }

    /**
     * Find existing conversation between two users or create one
     */
    @HandleError("Failed to find or create conversation", "PRIVATE_CHAT")
    async findOrCreateConversation(userA: string, userB: string) {
        let conversation = await this.findConversation(userA, userB);
        if (!conversation) {
            conversation = await this.createConversation(userA, userB);
        }
        return conversation;
    }

    /**
     * Get all conversations for a user
     */
    @HandleError("Error getting user's conversations", "PRIVATE_CHAT")
    async getUserConversations(userId: string) {
        const conversations = await this.prisma.privateConversation.findMany({
            where: {
                OR: [{ user1Id: userId }, { user2Id: userId }],
            },
            include: {
                lastMessage: {
                    include: {
                        sender: {
                            select: {
                                id: true,
                                profilePhoto: true,
                                full_name: true,
                                username: true,
                            },
                        },
                        service: true,
                    },
                },
                user1: {
                    select: {
                        id: true,
                        profilePhoto: true,
                        full_name: true,
                        username: true,
                    },
                },
                user2: {
                    select: {
                        id: true,
                        profilePhoto: true,
                        full_name: true,
                        username: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        return conversations.map((chat: any) => {
            const otherUser = chat.user1Id === userId ? chat.user2 : chat.user1;
            return {
                type: "private",
                chatId: chat.id,
                participant: otherUser,
                lastMessage: chat.lastMessage || null,
                updatedAt: chat.updatedAt,
                isRead: chat.lastMessage?.isRead || false,
            };
        });
    }

    /**
     * Get all messages for a conversation
     */
    @HandleError("Conversation doesn't exist", "PRIVATE_CHAT")
    async getConversationMessages(conversationId: string) {
        return this.prisma.privateMessage.findMany({
            where: { conversationId },
            include: {
                sender: true,
            },
            orderBy: { createdAt: "asc" },
        });
    }

    /**
     * Get a conversation with messages (validate access)
     */
    @HandleError("Conversation doesn't exist", "PRIVATE_CHAT")
    async getPrivateConversationWithMessages(
        conversationId: string,
        userId: string,
        serviceRequestsId?: string,
    ) {
        const conversation = await this.prisma.privateConversation.findFirst({
            where: {
                id: conversationId,
                OR: [{ user1Id: userId }, { user2Id: userId }],
            },
            include: {
                user1: {
                    select: {
                        id: true,
                        profilePhoto: true,
                        full_name: true,
                        username: true,
                    },
                },
                user2: {
                    select: {
                        id: true,
                        profilePhoto: true,
                        full_name: true,
                        username: true,
                    },
                },
                messages: {
                    orderBy: { createdAt: "asc" },
                    include: {
                        sender: {
                            select: {
                                id: true,
                                profilePhoto: true,
                                full_name: true,
                                username: true,
                            },
                        },
                        service: { include: { serviceRequests: true } },
                        serviceRequest: true,
                    },
                },
            },
        });

        if (!conversation) {
            throw new AppError(404, `Conversation not found or access denied`);
        }

        const messagesWithFilteredServiceRequests = conversation.messages.map((msg) => {
            if (msg.service) {
                const filteredRequests = msg.service.serviceRequests.filter(
                    (sr) => sr.messageID === msg.id,
                );
                return {
                    ...msg,
                    service: {
                        ...msg.service,
                        serviceRequests: filteredRequests,
                    },
                };
            }
            return msg;
        });

        return {
            conversationId: conversation.id,
            participants: [conversation.user1, conversation.user2],
            messages: messagesWithFilteredServiceRequests,
        };
    }

    /**
     * Mark a message as read
     */
    @HandleError("Failed to mark message as read", "PRIVATE_CHAT")
    async makePrivateMassageReadTrue(id: string) {
        return this.prisma.privateMessage.updateMany({
            where: { id },
            data: { isRead: true },
        });
    }

    /**
     * Delete a conversation
     */
    @HandleError("Failed to delete conversation", "PRIVATE_CHAT")
    async deleteConversation(conversationId: string) {
        return this.prisma.privateConversation.deleteMany({
            where: { id: conversationId },
        });
    }

    /**
     * Get all users who have chatted with current user
     * Includes unread message count and last message info
     */
    @HandleError("Failed to get users who chatted with me", "PRIVATE_CHAT")
    async getAllUsersChatWithMe(userId: string) {
        const conversations = await this.prisma.privateConversation.findMany({
            where: {
                OR: [{ user1Id: userId }, { user2Id: userId }],
            },
            include: {
                lastMessage: {
                    include: {
                        sender: {
                            select: {
                                id: true,
                                profilePhoto: true,
                                full_name: true,
                                username: true,
                            },
                        },
                        service: true,
                        statuses: {
                            where: {
                                userId: userId,
                            },
                            select: {
                                status: true,
                            },
                        },
                    },
                },
                user1: {
                    select: {
                        id: true,
                        email: true,
                        profilePhoto: true,
                        full_name: true,
                        username: true,
                    },
                },
                user2: {
                    select: {
                        id: true,
                        email: true,
                        profilePhoto: true,
                        full_name: true,
                        username: true,
                    },
                },
                messages: {
                    where: {
                        senderId: {
                            not: userId,
                        },
                        statuses: {
                            some: {
                                userId: userId,
                                status: {
                                    not: "READ",
                                },
                            },
                        },
                    },
                    select: {
                        id: true,
                    },
                },
            },
            orderBy: { updatedAt: "desc" },
        });

        const formattedUsers = conversations.map((conversation) => {
            const otherUser =
                conversation.user1Id === userId ? conversation.user2 : conversation.user1;

            const unreadCount = conversation.messages.length;

            const lastMessageStatus = conversation.lastMessage?.statuses?.[0]?.status || null;
            const isLastMessageRead = lastMessageStatus === "READ";

            return {
                userId: otherUser.id,
                email: otherUser.email,
                fullName: otherUser.full_name,
                profilePhoto: otherUser.profilePhoto,
                username: otherUser.username,
                conversationId: conversation.id,
                unreadCount,
                lastMessage: conversation.lastMessage
                    ? {
                          id: conversation.lastMessage.id,
                          content: conversation.lastMessage.content,
                          createdAt: conversation.lastMessage.createdAt,
                          senderId: conversation.lastMessage.senderId,
                          sender: conversation.lastMessage.sender,
                          service: conversation.lastMessage.service,
                          username: conversation.lastMessage.sender.username,
                          isRead: isLastMessageRead,
                      }
                    : null,
                updatedAt: conversation.updatedAt,
            };
        });

        return successResponse(formattedUsers, "Users who chatted with you fetched successfully");
    }

    /**
     * ---  Update service request isDeclined and isAccepted status----
     */
    @HandleError("Failed to update service request", "PRIVATE_CHAT")
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
                                profilePhoto: true,
                                username: true,
                            },
                        },
                    },
                },
                buyer: {
                    select: {
                        id: true,
                        full_name: true,
                        profilePhoto: true,
                        username: true,
                    },
                },
            },
        });

        if (!serviceRequest) {
            throw new NotFoundException(`Service request with ID ${id} not found`);
        }

        const updated = await this.prisma.serviceRequest.update({
            where: { id },
            data: updateData,
            include: {
                service: {
                    include: {
                        creator: {
                            select: {
                                id: true,
                                full_name: true,
                                profilePhoto: true,
                                username: true,
                            },
                        },
                    },
                },
                buyer: {
                    select: {
                        id: true,
                        full_name: true,
                        profilePhoto: true,
                        username: true,
                    },
                },
            },
        });

        // --------------- Send notification to buyer when seller accepts or declines the service request ---------------
        try {
            if (updated.service && updated.service.creator) {
                const sellerName =
                    updated.service.creator.username ||
                    updated.service.creator.full_name ||
                    "Seller";
                const serviceName = updated.service.serviceName || "Your service request";

                if (updateData.isAccepted === true) {
                    // ---------------- Send acceptance notification to buyer ----------------
                    await this.firebaseNotificationService.sendToUser(
                        updated.buyerId,
                        {
                            title: " Service Request Accepted",
                            body: `${sellerName} has accepted your service request for "${serviceName}"`,
                            type: NotificationType.SERVICE_REQUEST,
                            data: {
                                serviceRequestId: id,
                                sellerId: updated.service.creator.id,
                                sellerName,
                                serviceName,
                                status: "ACCEPTED",
                                timestamp: new Date().toISOString(),
                            },
                        },
                        true,
                    );
                    console.log(` Acceptance notification sent to buyer ${updated.buyerId}`);

                    //  --------------- Send notification to seller Emit event for websocket listeners ---------------
                    this.eventEmitter.emit(EVENT_TYPES.SERVICE_REQUEST_ACCEPTED, {
                        info: {
                            serviceRequestId: id,
                            serviceId: updated.serviceId,
                            serviceName,
                            sellerId: updated.service.creator.id,
                            sellerName,
                            buyerId: updated.buyerId,
                            status: "ACCEPTED",
                            actionAt: new Date(),
                        },
                    });
                }

                if (updateData.isDeclined === true) {
                    // ------------------ Send decline notification to buyer ----------------
                    await this.firebaseNotificationService.sendToUser(
                        updated.buyerId,
                        {
                            title: " Service Request Declined",
                            body: `${sellerName} has declined your service request for "${serviceName}"`,
                            type: NotificationType.SERVICE_REQUEST,
                            data: {
                                serviceRequestId: id,
                                sellerId: updated.service.creator.id,
                                sellerName,
                                serviceName,
                                status: "DECLINED",
                                timestamp: new Date().toISOString(),
                            },
                        },
                        true,
                    );
                    console.log(`❌ Decline notification sent to buyer ${updated.buyerId}`);

                    //--------------- Send notification to seller Emit event for websocket listeners------------------
                    this.eventEmitter.emit(EVENT_TYPES.SERVICE_REQUEST_DECLINED, {
                        info: {
                            serviceRequestId: id,
                            serviceId: updated.serviceId,
                            serviceName,
                            sellerId: updated.service.creator.id,
                            sellerName,
                            buyerId: updated.buyerId,
                            status: "DECLINED",
                            actionAt: new Date(),
                        },
                    });
                }
            }
        } catch (error) {
            console.error(`Failed to send notification: ${error.message}`);
        }

        return updated;
    }

    /**
     *----------------  Update uploaded file URLs for a service request ----------------
     */
    @HandleError("Failed to update uploaded files for service request", "PRIVATE_CHAT")
    async updateUploadedFiles(id: string, uploadedUrls: string[], user: any) {
        const serviceRequest = await this.prisma.serviceRequest.findUnique({
            where: { id },
        });

        if (!serviceRequest) {
            throw new HttpException("Service request not found", 404);
        }

        if (serviceRequest.buyerId !== user.userId) {
            throw new HttpException("You are not authorized to update this service request", 403);
        }

        // ------------ Update service request with new URLs and reset status ---------------
        const updated = await this.prisma.serviceRequest.update({
            where: { id },
            data: {
                uploadedFileUrl: uploadedUrls.length > 0 ? uploadedUrls : ["no file"],
                isDeclined: false,
                isAccepted: false,
            },
            include: {
                service: {
                    include: {
                        creator: {
                            select: {
                                id: true,
                                full_name: true,
                                profilePhoto: true,
                                username: true,
                            },
                        },
                    },
                },
                buyer: {
                    select: {
                        id: true,
                        full_name: true,
                        profilePhoto: true,
                        username: true,
                    },
                },
            },
        });
        // ------------ send  firebase notification to seller about updated files ---------------
        try {
            if (updated.service && updated.service.creator) {
                const sellerName =
                    updated.service.creator.username ||
                    updated.service.creator.full_name ||
                    "Seller";
                const serviceName = updated.service.serviceName || "Your service request";

                await this.firebaseNotificationService.sendToUser(
                    updated.service.creator.id,
                    {
                        title: "📁 upload proof file ",
                        body: `${updated.buyer.username} has updated the proof files for "${serviceName}"`,
                        type: NotificationType.UPLOAD_PROOF,
                        data: {
                            serviceRequestId: id,
                            buyerId: updated.buyerId,
                            serviceName,
                            timestamp: new Date().toISOString(),
                        },
                    },
                    true,
                );
                console.log(
                    `📁 Update notification sent to seller ${updated.service.creator.id} about updated files`,
                );

                //--------------- Emit event for websocket listeners ----------------
                this.eventEmitter.emit("service_request.files_updated", {
                    info: {
                        serviceRequestId: id,
                        buyerId: updated.buyerId,
                        buyerName: updated.buyer.username,
                        serviceName,
                    },
                });
            }
        } catch (error) {
            console.error(`Failed to send notification: ${error.message}`);
        }

        return updated;
    }
}
