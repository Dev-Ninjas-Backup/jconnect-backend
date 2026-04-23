import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import chalk from "chalk";
import { ENVEnum } from "src/common/enum/env.enum";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { UtilsService } from "src/lib/utils/utils.service";

@Injectable()
export class SuperAdminService implements OnModuleInit {
    constructor(
        private readonly prisma: PrismaService,
        private readonly utils: UtilsService,
        private readonly configService: ConfigService,
    ) {}

    onModuleInit(): Promise<void> {
        return this.seedSuperAdminUser();
    }

    async seedSuperAdminUser(): Promise<void> {
        const superAdminEmail = this.configService.getOrThrow<string>(ENVEnum.SUPER_ADMIN_EMAIL);
        const superAdminPass = this.configService.getOrThrow<string>(ENVEnum.SUPER_ADMIN_PASS);

        const superAdminExists = await this.prisma.user.findFirst({
            where: {
                email: superAdminEmail,
            },
        });

        // * create super admin
        if (!superAdminExists) {
            await this.prisma.user.create({
                data: {
                    email: superAdminEmail,
                    password: await this.utils.hash(superAdminPass),
                    full_name: "Super Admin",
                    role: "SUPER_ADMIN",
                    isVerified: true,
                    isActive: true,
                    isLogin: true,
                    phoneVerified: true,
                    isDeleted: false,
                    is_terms_agreed: true,
                },
            });
            console.info(
                chalk.bgGreen.white.bold(
                    `🚀 Super Admin user created with email: ${superAdminEmail}`,
                ),
            );
            return;
        }

        // * Log & update if super admin already exists
        await this.prisma.user.update({
            where: {
                email: superAdminEmail,
            },
            data: {
                isActive: true,
                isVerified: true,
                role: "SUPER_ADMIN",
            },
        });
        console.info(
            chalk.bgGreen.white.bold(`🚀 Super Admin user exists with email: ${superAdminEmail}`),
        );
    }
}
