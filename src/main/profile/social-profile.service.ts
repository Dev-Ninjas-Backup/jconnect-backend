import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { CreateSocialProfileDto, UpdateSocialProfileDto } from "./dto/social-profile.dto";

@Injectable()
export class SocialProfileService {
    constructor(private prisma: PrismaService) {}

    async create(userId: string, data: CreateSocialProfileDto) {
        const profile = await this.prisma.profile.findUnique({
            where: { user_id: userId },
        });

        if (!profile) {
            throw new NotFoundException("Profile not found. Please create a profile first.");
        }

        const lastOrder = await this.prisma.socialProfile.findFirst({
            where: { profileId: userId },
            orderBy: { orderId: "desc" },
        });

        const nextOrderId = lastOrder ? lastOrder.orderId + 1 : 1;

        return this.prisma.socialProfile.create({
            data: {
                profileId: userId,
                orderId: nextOrderId,
                platformName: data.platformName,
                platformLink: data.platformLink,
            },
        });
    }

    async findAll(userId: string) {
        return this.prisma.socialProfile.findMany({
            where: { profileId: userId },
            orderBy: { orderId: "asc" },
        });
    }

    async findOne(userId: string, id: string) {
        const socialProfile = await this.prisma.socialProfile.findFirst({
            where: {
                id,
                profileId: userId,
            },
        });

        if (!socialProfile) {
            throw new NotFoundException("Social profile not found");
        }

        return socialProfile;
    }

    async update(userId: string, id: string, data: UpdateSocialProfileDto) {
        const socialProfile = await this.findOne(userId, id);

        return this.prisma.socialProfile.update({
            where: { id: socialProfile.id },
            data,
        });
    }

    async remove(userId: string, id: string) {
        const socialProfile = await this.findOne(userId, id);

        await this.prisma.socialProfile.delete({
            where: { id: socialProfile.id },
        });

        return { message: "Social profile deleted successfully" };
    }
}
