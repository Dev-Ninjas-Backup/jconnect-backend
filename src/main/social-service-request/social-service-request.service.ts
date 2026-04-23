import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "src/lib/prisma/prisma.service";
import {
    CreateSocialServiceRequestDto,
    UpdateSocialServiceRequestDto,
} from "./dto/create-social-service-request.dto";

@Injectable()
export class SocialServiceRequestService {
    constructor(private prisma: PrismaService) {}

    async create(dto: CreateSocialServiceRequestDto) {
        // Ensure artist exists
        const artist = await this.prisma.user.findUnique({ where: { id: dto.artistID } });
        if (!artist) throw new NotFoundException("Artist not found");

        // Ensure buyer exists
        const buyer = await this.prisma.user.findUnique({ where: { id: dto.buyerId } });
        if (!buyer) throw new NotFoundException("Buyer not found");

        return this.prisma.socialServiceRequest.create({
            data: {
                ...dto,
                preferredDeliveryDate: new Date(dto.preferredDeliveryDate),
            },
        });
    }

    findAll() {
        return this.prisma.socialServiceRequest.findMany({
            include: {
                artist: true,
                socialServiceBuyer: true,
            },
        });
    }

    async findOne(id: string) {
        const data = await this.prisma.socialServiceRequest.findUnique({
            where: { id },
            include: {
                artist: true,
                socialServiceBuyer: true,
            },
        });
        if (!data) throw new NotFoundException("Social service request not found");
        return data;
    }

    async update(id: string, dto: UpdateSocialServiceRequestDto) {
        const exist = await this.prisma.socialServiceRequest.findUnique({ where: { id } });
        if (!exist) throw new NotFoundException("Request not found");

        return this.prisma.socialServiceRequest.update({
            where: { id },
            data: {
                ...dto,
                preferredDeliveryDate: dto.preferredDeliveryDate
                    ? new Date(dto.preferredDeliveryDate)
                    : exist.preferredDeliveryDate,
            },
        });
    }

    async remove(id: string) {
        const exist = await this.prisma.socialServiceRequest.findUnique({ where: { id } });
        if (!exist) throw new NotFoundException("Request not found");

        return this.prisma.socialServiceRequest.delete({ where: { id } });
    }
}
