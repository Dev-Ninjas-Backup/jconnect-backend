import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "src/lib/prisma/prisma.service";
import { CreateSocialServiceDto, UpdateSocialServiceDto } from "./dto/create-social-service.dto";

@Injectable()
export class SocialServiceService {
    constructor(private prisma: PrismaService) {}

    async create(dto: CreateSocialServiceDto & { artistID: string }) {
        const artist = await this.prisma.user.findUnique({
            where: { id: dto.artistID },
        });

        if (!artist) {
            throw new NotFoundException(`Artist not found with ID: ${dto.artistID}`);
        }

        const { artistID, preferredDeliveryDate, ...rest } = dto;
        return this.prisma.socialService.create({
            data: {
                ...rest,
                artistID,
                attachedFiles: rest.attachedFiles ?? [],
                preferredDeliveryDate: new Date(preferredDeliveryDate),
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

    async findByArtist(artistId: string) {
        return this.prisma.socialService.findMany({
            where: { artistID: artistId },
            orderBy: { createdAt: "desc" },
        });
    }

    async update(id: string, dto: UpdateSocialServiceDto, artistId?: string) {
        if (artistId) {
            const listing = await this.prisma.socialService.findUnique({ where: { id } });
            if (!listing) throw new NotFoundException("Listing not found");
            if (listing.artistID !== artistId) throw new ForbiddenException("Not your listing");
        }
        const { artistID, preferredDeliveryDate, ...rest } = dto;
        return this.prisma.socialService.update({
            where: { id },
            data: {
                ...rest,
                ...(preferredDeliveryDate && {
                    preferredDeliveryDate: new Date(preferredDeliveryDate),
                }),
            },
        });
    }

    async remove(id: string, artistId?: string) {
        if (artistId) {
            const listing = await this.prisma.socialService.findUnique({ where: { id } });
            if (!listing) throw new NotFoundException("Listing not found");
            if (listing.artistID !== artistId) throw new ForbiddenException("Not your listing");
        }
        return this.prisma.socialService.delete({ where: { id } });
    }
}
