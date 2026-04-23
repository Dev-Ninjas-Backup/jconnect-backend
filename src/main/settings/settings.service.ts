import { HandleError } from "@common/error/handle-error.decorator";
import { successResponse } from "@common/utilsResponse/response.util";
import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { Announcement } from "./dto/announcement.dto";
import { UpdateSettingDto } from "./dto/create-dto";
import { GlobalSearchDto } from "./dto/global-search.dto";

@Injectable()
export class SettingsService {
    constructor(private prisma: PrismaService) {}

    async getSettings() {
        const settings = await this.prisma.setting.findUnique({
            where: { id: "platform_settings" },
        });

        if (!settings) throw new NotFoundException("Settings not found");

        return settings;
    }

    async updateSettings(dto: UpdateSettingDto) {
        await this.getSettings();
        return this.prisma.setting.update({
            where: { id: "platform_settings" },
            data: {
                platformFee_percents: dto.platformFee_percents ?? undefined,
                minimum_payout: dto.minimum_payout ?? undefined,
            },
        });
    }

    // ----------------------------- NOTIFICATION SETTINGS -----------------------------
    @HandleError("Failed to update notification settings")
    async updateNotificationSettingsToggleAdmin(userId: string) {
        const user = await this.prisma.user.findUnique({
            where: {
                id: userId,
            },
            include: {
                notificationToggles: true,
            },
        });

        if (!user) {
            throw new NotFoundException("Admin user not found");
        }

        return {
            message: "Notification settings updated successfully",
            data: user.notificationToggles,
        };
    }

    // -------------------createAnnouncement------------
    @HandleError("Failed to create announcement")
    async createAnnouncement(dto: Announcement) {
        const announcement = await this.prisma.announcement.create({
            data: {
                title: dto.title,
                description: dto.description,
            },
        });

        return successResponse(announcement, "Announcement created");
    }

    @HandleError("Failed to get announcement")
    async getAnnouncement() {
        const announcement = await this.prisma.announcement.findMany();
        return successResponse(announcement, "Announcement fetched");
    }

    //  deleteAnnouncement

    @HandleError("Failed to delete announcement")
    async deleteAnnouncement(id: string) {
        const announcement = await this.prisma.announcement.delete({
            where: {
                id: id,
            },
        });
        return successResponse(announcement, "Announcement deleted");
    }

    // ------------updateAnnouncement---
    @HandleError("Failed to update announcement")
    async updateAnnouncement(id: string, dto: Announcement) {
        const announcement = await this.prisma.announcement.update({
            where: {
                id: id,
            },
            data: {
                title: dto.title,
                description: dto.description,
            },
        });
        return successResponse(announcement, "Announcement updated");
    }

    // ------------globalSearch---
    @HandleError("Failed to perform global search")
    async globalSearch(dto: GlobalSearchDto) {
        const { query, type = "all" } = dto;
        const searchTerm = query.toLowerCase();

        const results: any = {};

        if (type === "all" || type === "users") {
            results.users = await this.prisma.user.findMany({
                where: {
                    OR: [
                        { full_name: { contains: searchTerm, mode: "insensitive" } },
                        { email: { contains: searchTerm, mode: "insensitive" } },
                        { phone: { contains: searchTerm, mode: "insensitive" } },
                    ],
                },
                select: {
                    id: true,
                    full_name: true,
                    email: true,
                    phone: true,
                    role: true,
                    isActive: true,
                },
                take: 20,
            });
        }

        if (type === "all" || type === "orders") {
            results.orders = await this.prisma.order.findMany({
                where: {
                    OR: [
                        { orderCode: { contains: searchTerm, mode: "insensitive" } },
                        { buyer: { full_name: { contains: searchTerm, mode: "insensitive" } } },
                        { seller: { full_name: { contains: searchTerm, mode: "insensitive" } } },
                    ],
                },
                select: {
                    id: true,
                    orderCode: true,
                    amount: true,
                    status: true,
                    buyer: { select: { full_name: true, email: true } },
                    seller: { select: { full_name: true, email: true } },
                    createdAt: true,
                },
                take: 20,
            });
        }

        if (type === "all" || type === "services") {
            results.services = await this.prisma.service.findMany({
                where: {
                    OR: [
                        { serviceName: { contains: searchTerm, mode: "insensitive" } },
                        { description: { contains: searchTerm, mode: "insensitive" } },
                        { creator: { full_name: { contains: searchTerm, mode: "insensitive" } } },
                    ],
                },
                select: {
                    id: true,
                    serviceName: true,
                    serviceType: true,
                    price: true,
                    creator: { select: { full_name: true, email: true } },
                },
                take: 20,
            });
        }

        if (type === "all" || type === "disputes") {
            results.disputes = await this.prisma.dispute.findMany({
                where: {
                    OR: [
                        { order: { orderCode: { contains: searchTerm, mode: "insensitive" } } },
                        { user: { full_name: { contains: searchTerm, mode: "insensitive" } } },
                        { description: { contains: searchTerm, mode: "insensitive" } },
                    ],
                },
                select: {
                    id: true,
                    status: true,
                    description: true,
                    order: { select: { orderCode: true } },
                    user: { select: { full_name: true, email: true } },
                    createdAt: true,
                },
                take: 20,
            });
        }

        return successResponse(results, "Search completed successfully");
    }
}
