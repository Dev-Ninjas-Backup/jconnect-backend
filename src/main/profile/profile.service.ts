// src/profile/profile.service.ts
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { HandleError } from "@common/error/handle-error.decorator";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { CreateProfileDto, UpdateProfileDto } from "./dto/profile.dto";

@Injectable()
export class ProfileService {
    constructor(private prisma: PrismaService) {}

    async create(data: CreateProfileDto) {
        const user = await this.prisma.user.findUnique({
            where: { id: data.userId },
        });
        if (!user) throw new BadRequestException("User not found");

        const existing = await this.prisma.profile.findUnique({
            where: { user_id: data.userId },
        });
        if (existing) throw new BadRequestException("Profile already exists for this user");

        const profileData: any = {
            user_id: data.userId,
            profile_image_url: data.profile_image_url ?? undefined,
            short_bio: data.short_bio ?? undefined,
        };

        if (
            data.socialProfiles &&
            Array.isArray(data.socialProfiles) &&
            data.socialProfiles.length
        ) {
            profileData.socialProfiles = {
                create: data.socialProfiles.map((sp, index) => ({
                    orderId: index + 1,
                    platformName: sp.platformName,
                    platformLink: sp.platformLink,
                })),
            };
        }

        // ----------------Create Profile with nested socialProfiles when provided-------------------
        return this.prisma.profile.create({ data: profileData });
    }

    @HandleError("Error fetching profiles")
    async findAll() {
        return this.prisma.profile.findMany({
            include: { user: { omit: { password: true } } },
        });
    }

    @HandleError("Error fetching profile")
    async findOne(user_id: string) {
        const profile = await this.prisma.profile.findUnique({
            where: { user_id },
            include: {
                user: {
                    select: {
                        id: true,
                        full_name: true,
                        email: true,
                        role: true,
                    },
                },
            },
        });
        if (!profile) throw new NotFoundException("Profile not found");
        return profile;
    }

    async update(user_id: string, data: UpdateProfileDto) {
        // 1️⃣ Check if profile exists
        const profile = await this.prisma.profile.findUnique({
            where: { user_id },
        });
        if (!profile) throw new NotFoundException("Profile not found");

        const updatePayload: any = {
            profile_image_url: data.profile_image_url ?? undefined,
            short_bio: data.short_bio ?? undefined,
        };

        if (data.socialProfiles && Array.isArray(data.socialProfiles)) {
            updatePayload.socialProfiles = {
                deleteMany: {},
                create: data.socialProfiles.map((sp, index) => ({
                    orderId: index + 1,
                    platformName: sp.platformName,
                    platformLink: sp.platformLink,
                })),
            };
        }

        // 3️⃣ Update the profile; nested socialProfiles will be replaced if provided
        return this.prisma.profile.update({
            where: { user_id },
            data: updatePayload,
        });
    }

    async remove(user_id: string) {
        const profile = await this.prisma.profile.findUnique({ where: { user_id } });
        if (!profile) throw new NotFoundException("Profile not found");

        return this.prisma.profile.delete({ where: { user_id } });
    }
}
