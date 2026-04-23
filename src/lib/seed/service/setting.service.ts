import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { PrismaService } from "src/lib/prisma/prisma.service";
import { UtilsService } from "src/lib/utils/utils.service";

@Injectable()
export class seedSettingSrvice implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly utils: UtilsService,
        private readonly configService: ConfigService,
    ) {}

    onModuleInit(): Promise<void> {
        return this.seedSettings();
    }

    async seedSettings(): Promise<void> {
        // Use upsert to create or update the settings
        await this.prisma.setting.upsert({
            where: {
                id: "platform_settings",
            },
            create: {
                platformFee_percents: 10,
                minimum_payout: 10,
            },
            update: {
                // Update only if values are not set
                platformFee_percents: 10,
                minimum_payout: 10,
            },
        });
    }
}
