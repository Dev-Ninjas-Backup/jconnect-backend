import { Injectable } from "@nestjs/common";
import chalk from "chalk";
import { ServiceType } from "@prisma/client";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { UtilsService } from "src/lib/utils/utils.service";

@Injectable()
export class DatabaseSeedService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly utils: UtilsService,
    ) {}

    async seedDatabase(): Promise<void> {
        try {
            console.log(chalk.blue("🌱 Starting database seeding..."));

            const hashedPassword = await this.utils.hash("12345678");

            // Create test users
            const users = await this.createUsers(hashedPassword);
            console.log(chalk.green("✅ Users created"));

            // Create profiles
            await this.createProfiles(users);
            console.log(chalk.green("✅ Profiles created"));

            // Create services
            const services = await this.createServices(users);
            console.log(chalk.green("✅ Services created"));

            // Create orders and payments
            await this.createOrdersAndPayments(users, services);
            console.log(chalk.green("✅ Orders and Payments created"));

            // Create reviews
            await this.createReviews(users);
            console.log(chalk.green("✅ Reviews created"));

            // Create notifications
            await this.createNotifications(users);
            console.log(chalk.green("✅ Notifications created"));

            console.log(chalk.bgGreen.white.bold("🎉 Database seeding completed!"));
        } catch (error) {
            console.error(chalk.red("❌ Error seeding database:"), error);
            throw error;
        }
    }

    private async createUsers(hashedPassword: string) {
        const existingUsers = await this.prisma.user.findMany({
            where: {
                email: {
                    in: ["john@example.com", "sarah@example.com", "mike@example.com"],
                },
            },
        });

        if (existingUsers.length > 0) {
            console.log(chalk.yellow("⚠️  Test users already exist, skipping..."));
            return existingUsers;
        }

        return Promise.all([
            this.prisma.user.create({
                data: {
                    full_name: "John Artist",
                    email: "john@example.com",
                    password: hashedPassword,
                    role: "ARTIST",
                    isVerified: true,
                    isActive: true,
                    phoneVerified: true,
                    is_terms_agreed: true,
                    phone: "+8801712345678",
                },
            }),
            this.prisma.user.create({
                data: {
                    full_name: "Sarah Creator",
                    email: "sarah@example.com",
                    password: hashedPassword,
                    role: "ARTIST",
                    isVerified: true,
                    isActive: true,
                    phoneVerified: true,
                    is_terms_agreed: true,
                    phone: "+8801812345678",
                },
            }),
            this.prisma.user.create({
                data: {
                    full_name: "Mike Buyer",
                    email: "mike@example.com",
                    password: hashedPassword,
                    role: "USER",
                    isVerified: true,
                    isActive: true,
                    phoneVerified: true,
                    is_terms_agreed: true,
                    phone: "+8801912345678",
                },
            }),
        ]);
    }

    private async createProfiles(users: any[]) {
        const existingProfiles = await this.prisma.profile.findMany({
            where: {
                user_id: {
                    in: users.map((u) => u.id),
                },
            },
        });

        if (existingProfiles.length > 0) {
            return;
        }

        await Promise.all([
            this.prisma.profile.create({
                data: {
                    user_id: users[0].id,
                    short_bio: "Professional artist with 5 years experience",
                    socialProfiles: {
                        create: [
                            {
                                orderId: 1,
                                platformName: "Instagram",
                                platformLink: "https://instagram.com/johnartist",
                            },
                            {
                                orderId: 2,
                                platformName: "Facebook",
                                platformLink: "https://facebook.com/johnartist",
                            },
                        ],
                    },
                },
            }),
            this.prisma.profile.create({
                data: {
                    user_id: users[1].id,
                    short_bio: "Creative content creator",
                    socialProfiles: {
                        create: [
                            {
                                orderId: 1,
                                platformName: "Instagram",
                                platformLink: "https://instagram.com/sarahcreator",
                            },
                            {
                                orderId: 2,
                                platformName: "YouTube",
                                platformLink: "https://youtube.com/@sarahcreator",
                            },
                        ],
                    },
                },
            }),
        ]);
    }

    private async createServices(users: any[]) {
        const existingServices = await this.prisma.service.findMany({
            where: {
                creatorId: {
                    in: users.map((u) => u.id),
                },
            },
        });

        if (existingServices.length > 0) {
            return existingServices;
        }

        return Promise.all([
            this.prisma.service.create({
                data: {
                    serviceName: "Instagram Shoutout",
                    serviceType: ServiceType.SOCIAL_POST,
                    description: "Professional Instagram shoutout",
                    price: 50.0,
                    creatorId: users[0].id,
                    isPost: true,
                },
            }),
            this.prisma.service.create({
                data: {
                    serviceName: "TikTok Video",
                    serviceType: ServiceType.SOCIAL_POST,
                    description: "Custom TikTok video",
                    price: 100.0,
                    creatorId: users[1].id,
                    isPost: true,
                },
            }),
        ]);
    }

    private async createOrdersAndPayments(users: any[], services: any[]) {
        const existingPayments = await this.prisma.payment.findMany({
            where: {
                userId: users[2]?.id,
            },
        });

        if (existingPayments.length > 0) {
            return;
        }

        const payment = await this.prisma.payment.create({
            data: {
                sessionId: "cs_test_" + Date.now(),
                amount: 5000,
                currency: "USD",
                status: "COMPLETED",
                userId: users[2].id,
                serviceId: services[0].id,
            },
        });

        await this.prisma.order.create({
            data: {
                orderCode: "ORD-" + Date.now(),
                amount: 5000,
                seller_amount: 4500,
                PlatfromRevinue: 400,
                stripeFee: 100,
                status: "RELEASED",
                buyerId: users[2].id,
                sellerId: users[0].id,
                serviceId: services[0].id,
                platformFee: 400,
                platformFee_percents: 8,
                buyerPay: 5000,
                proofUrl: [],
                isReleased: true,
            },
        });
    }

    private async createReviews(users: any[]) {
        const existingReviews = await this.prisma.review.findMany({
            where: {
                reviewerId: users[2]?.id,
            },
        });

        if (existingReviews.length > 0) {
            return;
        }

        await this.prisma.review.create({
            data: {
                reviewerId: users[2].id,
                artistId: users[0].id,
                rating: 5,
                reviewText: "Excellent service!",
            },
        });
    }

    private async createNotifications(users: any[]) {
        for (const user of users) {
            const existingToggle = await this.prisma.notificationToggle.findFirst({
                where: { userId: user.id },
            });

            if (!existingToggle) {
                await this.prisma.notificationToggle.create({
                    data: {
                        userId: user.id,
                        email: true,
                        userUpdates: true,
                        serviceCreate: true,
                    },
                });
            }
        }
    }
}
