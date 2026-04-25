import { ForbiddenException, HttpException, Injectable, NotFoundException } from "@nestjs/common";

import { HandleError } from "@common/error/handle-error.decorator";
import { AwsService } from "@main/aws/aws.service";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { EVENT_TYPES, InquiryMeta } from "@main/shared/notification/interface/events.name";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { OrderStatus, Role } from "@prisma/client";
import agoron2 from "argon2";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { UtilsService } from "src/lib/utils/utils.service";
import { FindArtistDto } from "./dto/findArtist.dto";
import { CreateUserDto, UpdateMeDto, UpdateUserDto } from "./dto/user.dto";
@Injectable()
export class UsersService {
    constructor(
        private prisma: PrismaService,
        private utils: UtilsService,
        private readonly eventEmitter: EventEmitter2,
        private readonly firebaseNotificationService: FirebaseNotificationService,
        private readonly awsService: AwsService,
    ) {}

    @HandleError("Failed to create user", "Create User")
    async create(Userdata: CreateUserDto) {
        const { password, ...users } = Userdata;
        try {
            const exists = await this.prisma.user.findUnique({
                where: { email: users.email },
            });
            if (exists)
                throw new HttpException(
                    "User already exists with this email choice another email",
                    400,
                );

            const hash = await agoron2.hash(password);
            const data = { ...users, password: hash };
            const user = await this.prisma.user.create({ data });
            const returnUser = { ...user, password: undefined };
            return returnUser;
        } catch (error) {
            throw new HttpException(error.message, 500);
        }
    }

    // -------------- check username availability ----------------
    @HandleError("Failed to check username availability", "Check Username Availability")
    async checkUsernameAvailability(username: string) {
        if (!username || username.trim() === "") {
            throw new HttpException("Username is required", 400);
        }

        const trimmedUsername = username.trim().toLowerCase();

        const existingUser = await this.prisma.user.findFirst({
            where: {
                username: {
                    equals: trimmedUsername,
                    mode: "insensitive",
                },
            },
        });

        if (existingUser) {
            return {
                success: false,
                available: false,
                message: "Username is already taken",
            };
        }

        return {
            success: true,
            available: true,
            message: "Username is available",
        };
    }

    /// ---------------------------- find all users with pagination, filtering, and search ----------------------------
    @HandleError("Failed to fetch users", "Get Users")
    async findAll(params: {
        page: number;
        limit: number;
        isActive?: boolean;
        search?: string;
        currentUserId?: string;
    }) {
        const { page, limit, isActive, search, currentUserId } = params;

        const whereCondition: any = {
            ...(isActive !== undefined ? { isActive } : {}),
            ...(currentUserId && { id: { not: currentUserId } }),
        };

        if (search) {
            whereCondition.OR = [
                { full_name: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
            ];
        }

        const skip = (page - 1) * limit;

        const [data, total] = await this.prisma.$transaction([
            this.prisma.user.findMany({
                where: whereCondition,
                skip,
                take: limit,
                orderBy: { created_at: "desc" },
                select: {
                    id: true,
                    full_name: true,
                    email: true,
                    phone: true,
                    isActive: true,
                    isVerified: true,
                    created_at: true,
                    role: true,
                    username: true,
                    profilePhoto: true,
                },
            }),
            this.prisma.user.count({ where: whereCondition }),
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            success: true,
            page,
            limit,
            total,
            totalPages,
            data,
        };
    }

    // async findMe(Id: string) {
    //     // ---------------------------
    //     const user = await this.prisma.user.findUnique({
    //         where: { id: Id },
    //         omit: { password: true },
    //         include: {
    //             profile: true,
    //             devices: true,

    //             //  Service relations
    //             services: true,
    //             serviceRequests: {
    //                 include: {
    //                     buyer: true,
    //                     service: true,
    //                 },
    //             },

    //             //  LiveChat relations
    //             LiveChatsCreated: true,
    //             chatParticipations: {
    //                 include: {
    //                     chat: true,
    //                 },
    //             },
    //             liveMessages: true,
    //             liveMessageReads: {
    //                 include: {
    //                     message: true,
    //                 },
    //             },

    //             //  Custom service requests
    //             customRequestsMade: {
    //                 include: {
    //                     buyer: true,
    //                     targetCreator: true,
    //                 },
    //             },
    //             customRequestsReceived: {
    //                 include: {
    //                     buyer: true,
    //                     targetCreator: true,
    //                 },
    //             },

    //             //  Social services
    //             socialServices: {
    //                 include: {},
    //             },
    //         },
    //     });

    //     // ---------------------------

    //     // return await this.prisma.user.findUnique({ where: { id: Id }, omit: { password: true }, });

    //     return user;
    // }

    async findMe(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            omit: { password: true },
            include: {
                profile: {
                    include: {
                        socialProfiles: true,
                    },
                },
                highlights: {
                    orderBy: { createdAt: "desc" },
                },
                // devices: true,
                services: true,
                following: {
                    include: {
                        following: {
                            select: {
                                id: true,
                                full_name: true,
                                profilePhoto: true,
                                fcmToken: true,
                                username: true,
                            },
                        },
                    },
                },
                follwers: {
                    include: {
                        followers: {
                            select: {
                                id: true,
                                full_name: true,
                                profilePhoto: true,
                                fcmToken: true,
                                username: true,
                            },
                        },
                    },
                },
                // serviceRequests: {
                //     include: {
                //         buyer: true,
                //         service: true,
                //     },
                // },
                // LiveChatsCreated: true,
                // chatParticipations: {
                //     include: { chat: true },
                // },
                // liveMessages: true,
                // liveMessageReads: {
                //     include: { message: true },
                // },
                // customRequestsMade: {
                //     include: {
                //         buyer: true,
                //         targetCreator: true,
                //     },
                // },
                // customRequestsReceived: {
                //     include: {
                //         buyer: true,
                //         targetCreator: true,
                //     },
                // },
                // socialServices: true,
                // orders_buyer: true,
                // orders_seller: true,
                // paymentMethod: true,
            },
        });

        if (!user) throw new Error("User not found");

        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const totalDeals = await this.prisma.order.count({
            where: {
                sellerId: id,
                status: OrderStatus.RELEASED,
                // updatedAt: { gte: startDate, lte: endDate },
            },
        });

        // const totalEarningsResult = await this.prisma.order.aggregate({
        //     _sum: { seller_amount: true },
        //     where: {
        //         sellerId: id,
        //         status: OrderStatus.RELEASED,
        //         updatedAt: { gte: startDate, lte: endDate },
        //     },
        // });
        // const totalEarnings = (totalEarningsResult._sum.seller_amount || 0) / 100;

        // ---------------------------- total earnings calculation ----------------------------
        const totalReleased = await this.prisma.order.aggregate({
            where: { sellerId: id, status: OrderStatus.RELEASED },
            _sum: { seller_amount: true },
        });
        const totalSuccessfullREleaseAmount = totalReleased._sum.seller_amount || 0;
        const pendingOrders = await this.prisma.order.aggregate({
            where: {
                sellerId: id,
                status: {
                    in: [OrderStatus.IN_PROGRESS, OrderStatus.PROOF_SUBMITTED],
                },
            },
            _sum: { seller_amount: true },
        });

        const pendingClearance = pendingOrders._sum.seller_amount || 0;
        let totalEarning = totalSuccessfullREleaseAmount + pendingClearance;
        totalEarning = totalEarning / 100;
        // ---------------------------- total earnings calculation ----------------------------

        const avgRatingResult = await this.prisma.review.aggregate({
            _avg: { rating: true },
            where: {
                artistId: id,
            },
        });
        const avgRating = avgRatingResult._avg.rating ?? 0;

        const followingCount = user.following ? user.following.length : 0;
        const followerCount = user.follwers ? user.follwers.length : 0;

        return {
            ...user,
            followingCount,
            followerCount,
            stats: {
                totalDeals,
                totalEarnings: totalEarning,
                avgRating: parseFloat(avgRating.toFixed(2)),
                monthRange: {
                    start: startDate.toISOString(),
                    end: endDate.toISOString(),
                },
            },
        };
    }

    // ---------------------------- update profile with transaction and social profiles handling ----------------------------
    @HandleError("Failed to update profile", "Update Profile")
    async updateMe(userId: string, dto: UpdateMeDto, highlightFiles: Express.Multer.File[] = []) {
        console.log("Received DTO:", JSON.stringify(dto, null, 2));

        const existingUser = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!existingUser) throw new NotFoundException("User not found");

        if (dto.phone) {
            const existPhoneNumber = await this.prisma.user.findFirst({
                where: { phone: dto.phone },
            });

            if (existPhoneNumber && existPhoneNumber.id !== userId) {
                throw new HttpException("Phone number already in use by another user", 400);
            }
        }

        if (dto.username) {
            const existUsername = await this.prisma.user.findFirst({
                where: { username: dto.username },
            });

            if (existUsername && existUsername.id !== userId) {
                throw new HttpException("Username already in use by another user", 400);
            }
        }

        // -------------- User table updates ---------------
        const userPayload: UpdateUserDto = {};
        if (dto.full_name !== undefined) userPayload.full_name = dto.full_name;
        if (dto.phone !== undefined && dto.phone !== null && dto.phone.trim() !== "") {
            userPayload.phone = dto.phone;
        }
        if (dto.profilePhoto !== undefined) userPayload.profilePhoto = dto.profilePhoto;
        if (dto.location !== undefined) userPayload.location = dto.location;
        if (dto.hashTags !== undefined) userPayload.hashTags = dto.hashTags;
        if (dto.username !== undefined) userPayload.username = dto.username;

        // Profile table updates
        const profilePayload = {
            profile_image_url: dto.profile_image_url ?? undefined,
            short_bio: dto.short_bio ?? undefined,
        };

        // Social profiles processing
        let validSocialProfiles: { orderId: number; platformName: string; platformLink: string }[] =
            [];

        if (dto.socialProfiles && Array.isArray(dto.socialProfiles)) {
            console.log("Processing socialProfiles:", dto.socialProfiles);

            validSocialProfiles = dto.socialProfiles.map((sp, index) => ({
                orderId: index + 1,
                platformName: String(sp.platformName).trim(),
                platformLink: String(sp.platformLink).trim(),
            }));

            console.log("Valid social profiles:", validSocialProfiles);
        }

        const hasProfileChanges =
            Object.values(profilePayload).some((value) => value !== undefined) ||
            validSocialProfiles.length > 0;

        await this.prisma.$transaction(async (tx) => {
            // -------------- Update user table if needed ---------------
            if (Object.keys(userPayload).length > 0) {
                await tx.user.update({
                    where: { id: userId },
                    data: userPayload,
                });
            }

            // -------------- Update or create profile if needed -----------------
            if (hasProfileChanges) {
                const profileExists = await tx.profile.findUnique({
                    where: { user_id: userId },
                    include: { socialProfiles: true },
                });

                const profileData = {
                    ...profilePayload,
                };

                // -------------- Remove undefined values   -----------------
                Object.keys(profileData).forEach((key) => {
                    if (profileData[key] === undefined) {
                        delete profileData[key];
                    }
                });

                if (profileExists) {
                    // -------------- Update existing profile ---------------
                    await tx.profile.update({
                        where: { user_id: userId },
                        data: profileData,
                    });

                    // -------------- Always handle social profiles if provided ---------------
                    if (dto.socialProfiles !== undefined) {
                        // Delete existing social profiles
                        await tx.socialProfile.deleteMany({
                            where: { profileId: userId },
                        });

                        // -------------- Create new social profiles if any ---------------
                        if (validSocialProfiles.length > 0) {
                            console.log("Creating social profiles:", validSocialProfiles);
                            await tx.socialProfile.createMany({
                                data: validSocialProfiles.map((sp) => ({
                                    ...sp,
                                    profileId: userId,
                                })),
                            });
                        }
                    }
                } else {
                    // ----------  Create new profile if it doesn't exist ---------------
                    await tx.profile.create({
                        data: {
                            user_id: userId,
                            ...profileData,
                        },
                    });

                    // ------------ Create social profiles if any   ------------
                    if (validSocialProfiles.length > 0) {
                        await tx.socialProfile.createMany({
                            data: validSocialProfiles.map((sp) => ({
                                ...sp,
                                profileId: userId,
                            })),
                        });
                    }
                }
            }
        });

        // -------------- Handle highlights upload -----------------
        if (highlightFiles.length > 0) {
            if (highlightFiles.length > 20) {
                throw new HttpException("Maximum 20 highlights allowed at a time", 400);
            }

            const uploadedLinks = await Promise.all(
                highlightFiles.map((file) => this.awsService.upload(file).then((r) => r.url)),
            );

            await this.prisma.$transaction(async (tx) => {
                await tx.highlight.deleteMany({ where: { userId } });
                await tx.highlight.createMany({
                    data: uploadedLinks.map((fileLink) => ({ userId, fileLink })),
                });
            });
        }

        return this.findMe(userId);
    }

    async findAllArtist({ page = 1, limit, filter, search, username }: FindArtistDto, user: any) {
        const baseWhere: any = {
            isDeleted: false,
            isActive: true,
            isVerified: true,
            role: {
                notIn: [Role.SUPER_ADMIN],
            },
            ...(user?.userId && { id: { not: user.userId } }),
            ...(username && { username: { equals: username, mode: "insensitive" } }),
        };

        // 🔹 Add search system (artist_name OR service_name OR hashtags OR location)
        if (search) {
            baseWhere.OR = [
                {
                    full_name: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    username: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
                {
                    services: {
                        some: {
                            serviceName: {
                                contains: search,
                                mode: "insensitive",
                            },
                        },
                    },
                },
                {
                    hashTags: {
                        hasSome: [search],
                    },
                },
                {
                    location: {
                        contains: search,
                        mode: "insensitive",
                    },
                },
            ];
        }

        // ------------- Determine if we need to fetch all data (for sorting filters) -----------
        const needsFullDataset =
            filter && ["top-rated", "recently-updated", "suggested"].includes(filter);

        // -------------- Build query options -------------
        const queryOptions: any = {
            where: baseWhere,
            include: {
                services: {
                    orderBy: { updatedAt: "desc" },
                },
                ReviewsGiven: true,
                ReviewsReceived: true,
                highlights: {
                    orderBy: { createdAt: "desc" },
                },
            },
            orderBy: { created_at: "desc" },
        };

        // ---------------Only add database pagination if NO filter is applied AND limit is provided ----------------
        if (!needsFullDataset && limit) {
            queryOptions.skip = (page - 1) * limit;
            queryOptions.take = limit;
        }

        // ------------- Fetch data -------------
        const [artistsData, total] = await this.prisma.$transaction([
            this.prisma.user.findMany(queryOptions),
            this.prisma.user.count({ where: baseWhere }),
        ]);

        // ------------------Remove password from results and cast to any to preserve included relations ------------------
        const artists: any[] = artistsData.map(({ password, ...artist }) => artist);

        let sortedArtists: any[] = artists;

        if (filter === "top-rated") {
            sortedArtists = [...artists].sort((a, b) => {
                const avgA =
                    a.ReviewsReceived.length > 0
                        ? a.ReviewsReceived.reduce((sum: number, r: any) => sum + r.rating, 0) /
                          a.ReviewsReceived.length
                        : 0;
                const avgB =
                    b.ReviewsReceived.length > 0
                        ? b.ReviewsReceived.reduce((sum: number, r: any) => sum + r.rating, 0) /
                          b.ReviewsReceived.length
                        : 0;
                return avgB - avgA;
            });
        }

        // 🔹 Filter for recently updated artists
        if (filter === "recently-updated") {
            sortedArtists = artists
                .map((artist) => ({
                    ...artist,
                    latestServiceUpdate: artist.services?.[0]?.updatedAt ?? artist.updated_at,
                }))
                .sort(
                    (a, b) =>
                        new Date(b.latestServiceUpdate).getTime() -
                        new Date(a.latestServiceUpdate).getTime(),
                );
        }

        // 🔹 Suggested artists (example: most services)
        if (filter === "suggested") {
            sortedArtists = [...artists].sort(
                (a, b) => (b.services?.length ?? 0) - (a.services?.length ?? 0),
            );
        }

        // 🔹 Apply pagination after sort ONLY if filter was applied or no limit
        let paginated: any[];
        if (needsFullDataset && limit) {
            // Apply pagination after sorting
            const skip = (page - 1) * limit;
            paginated = sortedArtists.slice(skip, skip + limit);
        } else if (!limit) {
            // No limit - return all
            paginated = sortedArtists;
        } else {
            // Database pagination was already applied
            paginated = sortedArtists;
        }

        return {
            total,
            currentPage: page,
            totalPages: limit ? Math.ceil(total / limit) : 1,
            data: paginated,
        };
    }

    // async findOne(id: string) {
    //     const user = await this.prisma.user.findUnique({
    //         where: {
    //             id,
    //         },
    //         include: {
    //             services: true,
    //             ReviewsReceived: true,
    //             profile: true,
    //         },
    //     });
    //     return user;
    // }

    async findOne(id: string, currentUserId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            omit: { password: true },
            include: {
                services: {
                    orderBy: { createdAt: "desc" },
                },
                profile: {
                    include: {
                        socialProfiles: true,
                    },
                },
                ReviewsReceived: {
                    include: {
                        reviewer: {
                            select: {
                                id: true,
                                full_name: true,
                                profilePhoto: true,
                                username: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                },
                following: {
                    include: {
                        following: {
                            select: {
                                id: true,
                                full_name: true,
                                profilePhoto: true,
                                username: true,
                            },
                        },
                    },
                },
                follwers: {
                    include: {
                        followers: {
                            select: {
                                id: true,
                                full_name: true,
                                profilePhoto: true,
                                username: true,
                            },
                        },
                    },
                },
            },
        });

        if (!user) throw new NotFoundException("User not found");

        const avgRating = await this.prisma.review.aggregate({
            _avg: { rating: true },
            _count: { rating: true },
            where: { artistId: id },
        });

        const followingCount = user.following ? user.following.length : 0;
        const followerCount = user.follwers ? user.follwers.length : 0;

        return {
            ...user,
            averageRating: avgRating._avg.rating ? parseFloat(avgRating._avg.rating.toFixed(2)) : 0,
            totalReviews: avgRating._count.rating,
            followingCount,
            followerCount,
        };
    }

    // --------find one and inquiry user by email & notify service provider---------

    @HandleError("Failed to send inquiry", "User")
    async findOneUserIdInquiry(id: string, currentUserId: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            omit: { password: true },
            include: {
                services: {
                    orderBy: { createdAt: "desc" },
                },
                profile: {
                    include: {
                        socialProfiles: true,
                    },
                },
                ReviewsReceived: {
                    include: {
                        reviewer: {
                            select: {
                                id: true,
                                full_name: true,
                                profilePhoto: true,
                                username: true,
                                fcmToken: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: "desc",
                    },
                },
                following: {
                    include: {
                        following: {
                            select: {
                                id: true,
                                full_name: true,
                                profilePhoto: true,
                                fcmToken: true,
                                username: true,
                            },
                        },
                    },
                },
                follwers: {
                    include: {
                        followers: {
                            select: {
                                id: true,
                                full_name: true,
                                profilePhoto: true,
                                username: true,
                                fcmToken: true,
                            },
                        },
                    },
                },
            },
        });

        if (!user) throw new NotFoundException("User not found");

        const avgRating = await this.prisma.review.aggregate({
            _avg: { rating: true },
            _count: { rating: true },
            where: { artistId: id },
        });

        const followingCount = user.following ? user.following.length : 0;
        const followerCount = user.follwers ? user.follwers.length : 0;
        // -------------------------- notification send logic --------------------------

        //    --------- this user-------------
        const currentUser = await this.prisma.user.findUnique({
            where: { id: currentUserId },
            select: {
                id: true,
                email: true,
                full_name: true,
                role: true,
                username: true,
                profilePhoto: true,
                fcmToken: true,
            },
        });

        //  --------------------- Only emit if currentUser exists (prevents crash) --------------------
        if (currentUser) {
            // ----------------  Emit registration event ------------------
            this.eventEmitter.emit(EVENT_TYPES.INQUIRY_CREATE, {
                action: "CREATE",
                info: {
                    id: currentUser.id,
                    email: currentUser.email,
                    name: currentUser.full_name,
                    username: currentUser.username,
                    role: currentUser.role,
                    message:
                        " I like your profile and I wanna buy your service  " +
                        currentUser.username,
                    recipients: [{ id: user.id, email: user.email }],
                },
                meta: {
                    INQUIRER: "email",
                    currentUser,
                },
            } as unknown as InquiryMeta);

            // -------------------------- Firebase Push Notification --------------------------

            try {
                const inquiryMessage = `I like your profile and I wanna buy your service - ${currentUser.username}`;
                console.log("the message is now", inquiryMessage);
                //  ----------- Build notification using the NEW_MESSAGE template  ---------------
                const notification = this.firebaseNotificationService.buildNotificationTemplate(
                    NotificationType.NEW_MESSAGE,
                    {
                        senderName: currentUser.username,
                        senderId: currentUser.id,
                        messagePreview:
                            inquiryMessage ||
                            "I like your profile and I wanna buy your service - " +
                                currentUser.username,
                        conversationId: `inquiry_${currentUser.id}_${user.id}`,
                        recipients: [{ id: user.id, email: user.email }],
                    },
                );

                // ----------------  Send notification to the service provider  ----------------

                await this.firebaseNotificationService.sendToUser(user.id, notification, true);

                console.log(
                    ` Firebase notification sent for inquiry from ${currentUser.username} `,
                );
            } catch (firebaseError) {
                console.error(" Firebase notification failed for inquiry:", firebaseError.message);
            }
        }

        return {
            ...user,
            averageRating: avgRating._avg.rating ? parseFloat(avgRating._avg.rating.toFixed(2)) : 0,
            totalReviews: avgRating._count.rating,
            followingCount,
            followerCount,
        };
    }

    //--------------  Update user ---------------------
    async update(id: string, data: UpdateUserDto) {
        const exists = await this.prisma.user.findUnique({
            where: { id },
            omit: { password: true },
        });
        if (!exists) throw new NotFoundException("User not found");
        if (data.password) {
            const hash = await agoron2.hash(data.password);
            data.password = hash;
        }
        return await this.prisma.user.update({
            where: { id },
            omit: { password: true },
            data,
        });
    }

    // --------------reset password ----------------------------
    async reset_password(id: string, old: string, newPass: string) {
        const exists = await this.prisma.user.findUnique({ where: { id } });
        if (!exists) throw new NotFoundException("User not found");
        if (exists?.isDeleted) throw new NotFoundException("User Already deleted");
        const ValidPass = await this.utils.compare(old, exists.password);
        if (!ValidPass) throw new NotFoundException("Old Password is not correct");

        const hash = await this.utils.hash(newPass);

        return await this.prisma.user.update({
            where: { id },
            data: { password: hash },
            omit: { password: true },
        });
    }

    async updateRole(id: string, role: Role) {
        // ------------------Check if user exists--------------
        const user = await this.prisma.user.findUnique({ where: { id } });

        if (!user) throw new NotFoundException("User not found");
        if (user.isDeleted) throw new NotFoundException("User already deleted");

        // ------------------  Update role ----------------------------
        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: { role },
            omit: { password: true },
        });

        return {
            id: updatedUser.id,
            full_name: updatedUser.full_name,
            email: updatedUser.email,
            role: updatedUser.role,
            isActive: updatedUser.isActive,
            isVerified: updatedUser.isVerified,
            username: updatedUser.username,
        };
    }

    async deleteHighlight(userId: string, highlightId: string) {
        const highlight = await this.prisma.highlight.findUnique({
            where: { id: highlightId },
        });

        if (!highlight) throw new NotFoundException("Highlight not found");
        if (highlight.userId !== userId)
            throw new ForbiddenException("You are not authorized to delete this highlight");

        await this.prisma.highlight.delete({ where: { id: highlightId } });

        return {
            success: true,
            message: "Highlight deleted successfully",
        };
    }

    async remove(id: string) {
        const exists = await this.prisma.user.findUnique({ where: { id } });
        console.log(exists);

        if (!exists) throw new NotFoundException("User not found");
        // if (exists?.isDeleted) throw new NotFoundException("User Already deleted");

        // await this.prisma.user.update({
        //     where: { id },
        //     data: { isDeleted: true },
        //     omit: { password: true },
        // });

        await this.prisma.user.delete({ where: { id } });

        return {
            status: 200,
            message: "User deleted successfully",
        };
    }
}
