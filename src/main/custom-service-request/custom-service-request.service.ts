import { Injectable, NotFoundException } from "@nestjs/common";
import { CustomServiceRequest } from "@prisma/client";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { CreateCustomRequestDto } from "./dto/create-custom-request.dto";
import { UpdateCustomRequestDto } from "./dto/update-custom-request.dto";
import { HandleError } from "@common/error/handle-error.decorator";

@Injectable()
export class CustomServiceRequestService {
    constructor(private prisma: PrismaService) {}

    // CREATE
    @HandleError("Failed to create custom service request")
    async create(createDto: CreateCustomRequestDto): Promise<CustomServiceRequest> {
        const data = {
            ...createDto,
            preferredDeliveryDate: createDto.preferredDeliveryDate
                ? new Date(createDto.preferredDeliveryDate)
                : null,
        };

        return this.prisma.customServiceRequest.create({ data });
    }

    // FIND ALL
    @HandleError("Failed to fetch custom service requests")
    async findAll(): Promise<CustomServiceRequest[]> {
        return this.prisma.customServiceRequest.findMany({
            include: {
                buyer: true,
                targetCreator: true,
            },
        });
    }

    // FIND ONE
    @HandleError("Failed to find custom service request")
    async findOne(id: string): Promise<CustomServiceRequest> {
        const request = await this.prisma.customServiceRequest.findUnique({
            where: { id },
            include: { buyer: true, targetCreator: true },
        });

        if (!request) {
            throw new NotFoundException(`Custom request with ID "${id}" not found.`);
        }

        return request;
    }

    // UPDATE
    @HandleError("Failed to update custom service request")
    async update(id: string, updateDto: UpdateCustomRequestDto): Promise<CustomServiceRequest> {
        await this.findOne(id);
        const updateData = {
            ...updateDto,
            preferredDeliveryDate: updateDto.preferredDeliveryDate
                ? new Date(updateDto.preferredDeliveryDate)
                : undefined,
        };

        return this.prisma.customServiceRequest.update({
            where: { id },
            data: updateData,
        });
    }

    // DELETE
    @HandleError("Failed to delete custom service request")
    async remove(id: string): Promise<CustomServiceRequest> {
        await this.findOne(id);
        return this.prisma.customServiceRequest.delete({ where: { id } });
    }
}
