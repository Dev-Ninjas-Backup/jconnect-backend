import { PrismaClient, ServiceType } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Seeding database...");

    //------------------ Clear existing data --------------------------
    await prisma.liveMessageRead.deleteMany();
    await prisma.liveMessage.deleteMany();
    await prisma.liveChatParticipant.deleteMany();
    await prisma.liveChat.deleteMany();
    await prisma.privateMessageStatus.deleteMany();
    await prisma.privateMessage.deleteMany();
    await prisma.privateConversation.deleteMany();
    await prisma.supportMessage.deleteMany();
    await prisma.supportChat.deleteMany();
    await prisma.userNotification.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.notificationToggle.deleteMany();
    await prisma.dispute.deleteMany();
    await prisma.order.deleteMany();
    await prisma.buyService.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.review.deleteMany();
    await prisma.withdrawal.deleteMany();
    await prisma.paymentMethod.deleteMany();
    await prisma.customServiceRequest.deleteMany();
    await prisma.serviceRequest.deleteMany();
    await prisma.socialServiceRequest.deleteMany();
    await prisma.socialService.deleteMany();
    await prisma.service.deleteMany();
    await prisma.profile.deleteMany();
    await prisma.device.deleteMany();
    await prisma.user.deleteMany();

    //-------------------- Hash password -----------------------------
    const hashedPassword = await bcrypt.hash("12345678", 10);

    //-------------------- Create Users -----------------------------
    const users = await Promise.all([
        prisma.user.create({
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
        prisma.user.create({
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
        prisma.user.create({
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
        prisma.user.create({
            data: {
                full_name: "Admin User",
                email: "admin@example.com",
                password: hashedPassword,
                role: "ADMIN",
                isVerified: true,
                isActive: true,
                phoneVerified: true,
                is_terms_agreed: true,
                phone: "+8801612345678",
            },
        }),
    ]);

    console.log("✅ Users created");

    // ------------------Create Profiles ---------------------------
    await Promise.all([
        prisma.profile.create({
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
                        {
                            orderId: 3,
                            platformName: "TikTok",
                            platformLink: "https://tiktok.com/@johnartist",
                        },
                    ],
                },
            },
        }),
        prisma.profile.create({
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
                            platformLink: "https://youtube.com/sarahcreator",
                        },
                    ],
                },
            },
        }),
    ]);

    console.log("✅ Profiles created");

    //------------------------- Create Devices----------------------------------
    await prisma.device.create({
        data: {
            userId: users[0].id,
            browser: "Chrome",
            browserVersion: "120.0",
            os: "Windows",
            osVersion: "11",
            deviceType: "Desktop",
            ipAddress: "192.168.1.1",
        },
    });

    console.log("Devices created");

    // Create Services
    const services = await Promise.all([
        prisma.service.create({
            data: {
                serviceName: "Instagram Shoutout",
                serviceType: ServiceType.SOCIAL_POST,
                description: "Professional Instagram shoutout for your brand",
                price: 50.0,
                creatorId: users[0].id,
                isPost: true,
            },
        }),
        prisma.service.create({
            data: {
                serviceName: "TikTok Video Creation",
                serviceType: ServiceType.SOCIAL_POST,
                description: "Custom TikTok video for your product",
                price: 100.0,
                creatorId: users[1].id,
                isPost: true,
            },
        }),
        prisma.service.create({
            data: {
                serviceName: "YouTube Review",
                description: "Detailed product review on YouTube",
                price: 150.0,
                creatorId: users[0].id,
                serviceType: ServiceType.SOCIAL_POST,
            },
        }),
    ]);

    console.log(" Services created");

    // Create Service Requests
    await prisma.serviceRequest.create({
        data: {
            serviceId: services[0].id,
            buyerId: users[2].id,
            captionOrInstructions: "Please mention our brand name",
            price: 50.0,
            promotionDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });

    console.log("Service Requests created");

    // Create Custom Service Requests
    await prisma.customServiceRequest.create({
        data: {
            buyerId: users[2].id,
            targetCreatorId: users[0].id,
            serviceName: "Custom Brand Promotion",
            description: "Need a custom video for our new product launch",
            budgetRangeMin: 200.0,
            budgetRangeMax: 500.0,
            status: "PENDING",
        },
    });

    console.log(" Custom Service Requests created");

    // Create Social Services
    const socialService = await prisma.socialService.create({
        data: {
            serviceName: "Instagram Story",
            platforms: ["Instagram"],
            artistName: users[0].full_name,
            price: 75.0,
            preferredDeliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
            artistID: users[0].id,
        },
    });

    console.log(" Social Services created");

    // Create Social Service Requests
    await prisma.socialServiceRequest.create({
        data: {
            serviceName: "Facebook Post",
            socialServiceId: socialService.id,
            platforms: ["Facebook"],
            artistName: users[1].full_name,
            price: 60.0,
            preferredDeliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
            buyerId: users[2].id,
            artistID: users[1].id,
        },
    });

    console.log(" Social Service Requests created");

    // Create Payments
    const payment = await prisma.payment.create({
        data: {
            sessionId: "cs_test_" + Date.now(),
            amount: 5000,
            currency: "USD",
            status: "COMPLETED",
            userId: users[2].id,
            serviceId: services[0].id,
        },
    });

    console.log("Payments created");

    // Create Buy Services
    await prisma.buyService.create({
        data: {
            buyerId: users[2].id,
            sellerId: users[0].id,
            serviceId: services[0].id,
            paymentId: payment.id,
            amount: 5000,
            status: "SUCCESS",
        },
    });

    console.log(" Buy Services created");

    // Create Orders
    const order = await prisma.order.create({
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
            proofUrl: ["https://example.com/proof.jpg"],
            isReleased: true,
        },
    });

    console.log(" Orders created");

    // Create Reviews
    await prisma.review.create({
        data: {
            reviewerId: users[2].id,
            artistId: users[0].id,
            rating: 5,
            reviewText: "Excellent service! Highly recommended.",
        },
    });

    console.log(" Reviews created");

    // Create Payment Methods
    await prisma.paymentMethod.create({
        data: {
            userId: users[2].id,
            paymentMethod: "card",
            cardBrand: "visa",
            last4: "4242",
            expMonth: 12,
            expYear: 2025,
        },
    });

    console.log(" Payment Methods created");

    // Create Withdrawals
    await prisma.withdrawal.create({
        data: {
            userId: users[0].id,
            amount: 1000,
            ballance: 3500,
        },
    });

    console.log(" Withdrawals created");

    // Create Disputes
    await prisma.dispute.create({
        data: {
            orderId: order.id,
            userId: users[2].id,
            description: "Service not delivered as promised",
            status: "UNDER_REVIEW",
            proofs: ["https://example.com/dispute-proof.jpg"],
        },
    });

    console.log(" Disputes created");

    // Create Live Chats
    const liveChat = await prisma.liveChat.create({
        data: {
            type: "INDIVIDUAL",
            createdById: users[0].id,
        },
    });

    await Promise.all([
        prisma.liveChatParticipant.create({
            data: {
                chatId: liveChat.id,
                userId: users[0].id,
            },
        }),
        prisma.liveChatParticipant.create({
            data: {
                chatId: liveChat.id,
                userId: users[2].id,
            },
        }),
    ]);

    const liveMessage = await prisma.liveMessage.create({
        data: {
            chatId: liveChat.id,
            senderId: users[0].id,
            content: "Hello! How can I help you?",
            status: "DELIVERED",
        },
    });

    await prisma.liveMessageRead.create({
        data: {
            messageId: liveMessage.id,
            userId: users[2].id,
            liveChatId: liveChat.id,
        },
    });

    console.log(" Live Chats created");

    // Create Private Conversations
    const privateConv = await prisma.privateConversation.create({
        data: {
            user1Id: users[0].id,
            user2Id: users[2].id,
        },
    });

    const privateMsg = await prisma.privateMessage.create({
        data: {
            conversationId: privateConv.id,
            senderId: users[0].id,
            content: "Thanks for your order!",
            isRead: false,
        },
    });

    await prisma.privateMessageStatus.create({
        data: {
            messageId: privateMsg.id,
            userId: users[2].id,
            status: "DELIVERED",
        },
    });

    console.log(" Private Messages created");

    // Create Support Chats
    const supportChat = await prisma.supportChat.create({
        data: {
            userId: users[2].id,
            adminId: users[3].id,
            subject: "Payment Issue",
            status: "OPEN",
            priority: "HIGH",
        },
    });

    await prisma.supportMessage.create({
        data: {
            chatId: supportChat.id,
            senderId: users[2].id,
            content: "I have an issue with my payment",
            isAdmin: false,
        },
    });

    console.log(" Support Chats created");

    // Create Notifications
    const notification = await prisma.notification.create({
        data: {
            userId: users[0].id,
            title: "New Order Received",
            message: "You have received a new order for Instagram Shoutout",
            read: false,
        },
    });

    await prisma.userNotification.create({
        data: {
            userId: users[0].id,
            notificationId: notification.id,
            type: "Service",
            read: false,
        },
    });

    console.log(" Notifications created");

    // Create Notification Toggles
    await Promise.all(
        users.map((user) =>
            prisma.notificationToggle.create({
                data: {
                    userId: user.id,
                    email: true,
                    userUpdates: true,
                    serviceCreate: true,
                    review: true,
                    post: true,
                    message: true,
                },
            }),
        ),
    );

    console.log(" Notification Toggles created");

    console.log("🎉 Seeding completed successfully!");
}

main()
    .catch((e) => {
        console.error(" Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
