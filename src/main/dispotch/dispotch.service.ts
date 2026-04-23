import {
    BadRequestException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from "@nestjs/common";

import { AwsService } from "@main/aws/aws.service";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { CreateDisputeDto } from "./dto/create-dispute.dto";
import { FindDisputesDto } from "./dto/find-disputes.dto";
import { UpdateDisputeDto } from "./dto/update-dispute.dto";

@Injectable()
export class DisputeService {
    constructor(
        private prisma: PrismaService,
        private awsService: AwsService,
    ) {}

    async create(userId: string, dto: CreateDisputeDto, files?: Express.Multer.File[]) {
        // 1️⃣ Check if order exists and belongs to user
        const order = await this.prisma.order.findUnique({
            where: { id: dto.orderId, buyerId: userId },
        });
        console.log(order);
        if (!order) throw new NotFoundException("Order not found");

        // 2️⃣ Check for existing dispute under review
        const existingDispute = await this.prisma.dispute.findFirst({
            where: {
                orderId: dto.orderId,
                userId,
                status: "UNDER_REVIEW",
            },
        });

        if (existingDispute) {
            throw new BadRequestException(
                "You already have a dispute under review for this order.",
            );
        }

        // 3️⃣ Upload files to S3
        let proofUrls: string[] = [];
        if (files && files.length > 0) {
            proofUrls = await Promise.all(
                files.map(async (file) => {
                    const uploadResult = await this.awsService.upload(file);
                    return uploadResult.url;
                }),
            );
        }

        // 4️⃣ Create dispute
        const dispute = await this.prisma.dispute.create({
            data: {
                userId,
                orderId: dto.orderId,
                description: dto.description,
                resolution: dto.resolution,
                proofs: proofUrls, // save S3 URLs
                status: "UNDER_REVIEW",
            },
            include: {
                order: true,
                user: { omit: { password: true } },
            },
        });

        return { dispute };
    }

    async findAll(search?: string) {
        const where: any = {};

        if (search) {
            where.OR = [
                { id: { contains: search, mode: "insensitive" } },
                { order: { orderCode: { contains: search, mode: "insensitive" } } },
            ];
        }

        return this.prisma.dispute.findMany({
            where,
            include: {
                order: true,
                user: { select: { id: true, full_name: true } },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async findQuery(query?: FindDisputesDto, search?: string) {
        const page = query?.page ?? 1;
        const perPage = query?.perPage ?? 10;
        const skip = (page - 1) * perPage;

        const where: any = {};
        if (query?.status) where.status = query.status;
        if (query?.startDate || query?.endDate) {
            where.createdAt = {} as any;
            if (query.startDate) where.createdAt.gte = query.startDate;
            if (query.endDate) where.createdAt.lte = query.endDate;
        }

        if (search) {
            where.OR = [
                { id: { contains: search, mode: "insensitive" } },
                { order: { orderCode: { contains: search, mode: "insensitive" } } },
            ];
        }

        const [data, total] = await this.prisma.$transaction([
            this.prisma.dispute.findMany({
                where,
                include: {
                    order: true,
                    user: { select: { id: true, full_name: true } },
                },
                orderBy: { createdAt: "desc" },
                skip,
                take: perPage,
            }),
            this.prisma.dispute.count({ where }),
        ]);

        return {
            success: true,
            page,
            perPage,
            total,
            totalPages: Math.ceil(total / perPage),
            data,
        };
    }

    async findMyDisputes(userId: string) {
        return this.prisma.dispute.findMany({
            where: { userId },
            include: {
                order: {
                    include: {
                        seller: { omit: { password: true } },
                        service: true,
                        buyer: { omit: { password: true } },
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        });
    }

    async findOne(id: string) {
        const dispute = await this.prisma.dispute.findUnique({
            where: { id },
            include: {
                order: true,
                user: true,
            },
        });

        if (!dispute) throw new NotFoundException("Dispute not found");
        return dispute;
    }

    async update(id: string, dto: UpdateDisputeDto, user: any) {
        // 1️⃣ Fetch the dispute to check existence and ownership
        const dispute = await this.findOne(id); // assuming findOne throws NotFoundException if not found

        // 2️⃣ Check permissions
        const isAdmin = user.roles === "ADMIN";
        const isSuperAdmin = user.roles === "SUPER_ADMIN";
        const isOwner = dispute.userId === user.userId;
        console.log("ami user", user, isOwner, isAdmin, dispute, isSuperAdmin);
        if (!isAdmin && !isOwner && !isSuperAdmin) {
            throw new ForbiddenException("You do not have permission to update this dispute.");
        }

        await this.findOne(id); // exists check

        return this.prisma.dispute.update({
            where: { id },
            data: {
                ...dto,
                status: dto.status ?? undefined,
            },
            include: {
                order: true,
                user: true,
            },
        });
    }

    async remove(id: string, user: any) {
        const dispute = await this.findOne(id);

        const isAdmin = user.role === "ADMIN";
        const isSuperAdmin = user.role === "SUER_ADMIN";
        const isOwner = dispute.userId === user.userId;

        if (!isAdmin && !isOwner && !isSuperAdmin) {
            throw new ForbiddenException("You do not have permission to update this dispute.");
        }

        return this.prisma.dispute.delete({ where: { id } });
    }
}
