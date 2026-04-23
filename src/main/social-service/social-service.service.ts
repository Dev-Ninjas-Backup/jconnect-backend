import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "src/lib/prisma/prisma.service";
import { CreateSocialServiceDto, UpdateSocialServiceDto } from "./dto/create-social-service.dto";

@Injectable()
export class SocialServiceService {
    constructor(private prisma: PrismaService) {}

    async create(dto: CreateSocialServiceDto) {
        const artist = await this.prisma.user.findUnique({
            where: { id: dto.artistID },
        });

        if (!artist) {
            throw new NotFoundException(`Artist not found with ID: ${dto.artistID}`);
        }
        return this.prisma.socialService.create({
            data: {
                ...dto,
                preferredDeliveryDate: new Date(dto.preferredDeliveryDate),
            },
        });
    }

    async findAll() {
        return this.prisma.socialService.findMany({
            include: {
                artist: {
                    select: {
                        id: true,
                        profilePhoto: true,
                        full_name: true,
                        email: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async findOne(id: string) {
        return this.prisma.socialService.findUnique({
            where: { id },
            include: { artist: true },
        });
    }

    async update(id: string, dto: UpdateSocialServiceDto) {
        return this.prisma.socialService.update({
            where: { id },
            data: dto,
        });
    }

    async remove(id: string) {
        return this.prisma.socialService.delete({
            where: { id },
        });
    }
}
