import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
    private readonly logger = new Logger(PrismaService.name);

    readonly utils = Prisma;

    constructor() {
        super({
            log: [{ emit: "event", level: "error" }],
        });
    }

    async onModuleInit() {
        console.log("🚀 Prisma connected");
        await this.$connect();
    }
}
