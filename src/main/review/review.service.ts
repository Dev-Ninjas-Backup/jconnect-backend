import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
// Ensure this path matches your PrismaService location
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { MailService } from "src/lib/mail/mail.service";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { CreateReviewDto } from "./dto/create-review.dto";
import { UpdateReviewDto } from "./dto/update-review.dto";

@Injectable()
export class ReviewService {
    constructor(
        private prisma: PrismaService,
        private readonly firebaseNotificationService: FirebaseNotificationService,
        private readonly mailService: MailService,
    ) {}

    // ** 1. CREATE (Create Review) - POST **
    async create(createReviewDto: CreateReviewDto, user: any) {
        // Prevent self-reviewing
        if (user.userId === createReviewDto.artistId) {
            throw new BadRequestException("An artist cannot review themselves.");
        }

        try {
            const review = await this.prisma.review.create({
                data: { ...createReviewDto, reviewerId: user.userId },
                include: {
                    reviewer: {
                        select: { id: true, username: true, full_name: true, email: true },
                    },
                    artist: {
                        select: { id: true, username: true, full_name: true, email: true },
                    },
                },
            });

            //------------------ Send review notification to artist ------------------//
            try {
                await this.firebaseNotificationService.sendToUser(
                    createReviewDto.artistId,
                    {
                        title: `New Review from ${review.reviewer.username}`,
                        body: `You received a ${review.rating}-star review: "${review.reviewText?.substring(0, 50)}${review.reviewText && review.reviewText.length > 50 ? "..." : ""}"`,
                        type: NotificationType.REVIEW_RECEIVED,
                        data: {
                            reviewId: review.id,
                            reviewerId: review.reviewer.id,
                            rating: review.rating.toString(),
                            timestamp: new Date().toISOString(),
                        },
                    },
                    true,
                );
                console.log(` Review notification sent to artist ${createReviewDto.artistId}`);
            } catch (error) {
                console.error(` Failed to send review notification: ${error.message}`);
            }

            //------------------ Send review email to artist ------------------//
            try {
                const emailHtml = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body {
                                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                                line-height: 1.6;
                                color: #333;
                                margin: 0;
                                padding: 0;
                                background-color: #f5f7fa;
                            }
                            .container {
                                max-width: 600px;
                                margin: 40px auto;
                                background: white;
                                border-radius: 12px;
                                overflow: hidden;
                                box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                            }
                            .header {
                                background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
                                color: white;
                                padding: 40px 30px;
                                text-align: center;
                            }
                            .logo {
                                font-size: 32px;
                                font-weight: bold;
                                margin-bottom: 10px;
                                letter-spacing: 1px;
                            }
                            .header-subtitle {
                                font-size: 16px;
                                opacity: 0.95;
                            }
                            .content {
                                padding: 40px 30px;
                            }
                            .rating-box {
                                background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                                border: 2px solid #f59e0b;
                                padding: 30px;
                                text-align: center;
                                margin: 30px 0;
                                border-radius: 10px;
                            }
                            .rating-stars {
                                font-size: 48px;
                                margin: 15px 0;
                            }
                            .rating-label {
                                font-size: 18px;
                                font-weight: bold;
                                color: #f59e0b;
                            }
                            .review-text-box {
                                background: #f8fafc;
                                border-left: 4px solid #f59e0b;
                                padding: 20px;
                                margin: 25px 0;
                                border-radius: 6px;
                                font-style: italic;
                                color: #475569;
                            }
                            .reviewer-info {
                                background: #f3f4f6;
                                padding: 15px;
                                border-radius: 8px;
                                margin: 20px 0;
                            }
                            .reviewer-name {
                                font-weight: 600;
                                color: #1e293b;
                                margin-bottom: 5px;
                            }
                            .info-box {
                                background: #dbeafe;
                                border-left: 4px solid #f59e0b;
                                padding: 16px;
                                margin: 25px 0;
                                border-radius: 6px;
                            }
                            .footer {
                                text-align: center;
                                padding: 25px;
                                background: #f8fafc;
                                color: #64748b;
                                font-size: 13px;
                                border-top: 1px solid #e2e8f0;
                            }
                            .brand-name {
                                color: #f59e0b;
                                font-weight: 600;
                            }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <div class="logo">⭐ Dj Connect</div>
                                <div class="header-subtitle">New Review Received</div>
                            </div>
                            <div class="content">
                                <h2 style="color: #1e293b; margin-bottom: 20px;">Congratulations! 🎉</h2>
                                <p style="font-size: 16px; color: #475569;">You received a new review on <span class="brand-name">DaConnect</span>!</p>
                                
                                <div class="rating-box">
                                    <p style="margin: 0; font-size: 14px; color: #92400e; text-transform: uppercase; letter-spacing: 1px;">Rating</p>
                                    <div class="rating-stars">${"⭐".repeat(review.rating)}</div>
                                    <div class="rating-label">${review.rating} out of 5 stars</div>
                                </div>
                                
                                <div class="reviewer-info">
                                    <div class="reviewer-name">From: ${review.reviewer.full_name || review.reviewer.username}</div>
                                    <p style="margin: 0; font-size: 14px; color: #64748b;">@${review.reviewer.username}</p>
                                </div>

                                ${
                                    review.reviewText
                                        ? `
                                    <div class="review-text-box">
                                        "${review.reviewText}"
                                    </div>
                                `
                                        : ""
                                }
                                
                                <div class="info-box">
                                    <strong style="color: #92400e;"> Great Impact:</strong>
                                    <p style="margin: 10px 0 0 0; color: #475569;">This review helps other users discover your talent. Keep up the great work and building your reputation on DaConnect!</p>
                                </div>
                                
                                <p style="font-size: 14px; color: #64748b; margin-top: 25px;">View all your reviews in your DaConnect profile to track your rating and feedback.</p>
                            </div>
                            
                            <div class="footer">
                                <p style="margin: 5px 0;">This is an automated email from <strong class="brand-name">DaConnect</strong>. Please do not reply.</p>
                                <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} DaConnect. All rights reserved.</p>
                                <p style="margin: 10px 0; font-size: 12px;">Connecting creators and music lovers worldwide.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `;

                await this.mailService.sendEmail(
                    review.artist.email,
                    `You received a new ${review.rating}-star review on DaConnect`,
                    emailHtml,
                );
                console.log(` Review email sent to ${review.artist.email}`);
            } catch (error) {
                console.error(` Failed to send review email: ${error.message}`);
            }

            return review;
        } catch (error) {
            //---------------- Handle Prisma unique constraint violation---------------------
            if (error.code === "P2002") {
                throw new BadRequestException("You have already reviewed this artist.");
            }
            throw error;
        }
    }

    //  READ (Fetch all reviews for an Artist) - GET **
    async findAllByArtist(artistId: string) {
        console.log(artistId);
        // 1. Fetch all reviews for the artist
        const reviews = await this.prisma.review.findMany({
            where: { artistId },
            include: {
                // Include the reviewer's full_name and email
                reviewer: {
                    select: { full_name: true, email: true, username: true },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        console.log(reviews);
        // 2. Calculate the aggregate rating (average and count)
        const avgRating = await this.prisma.review.aggregate({
            _avg: { rating: true },
            _count: { rating: true },
            where: { artistId },
        });

        return {
            reviews,
            // Format the average rating to two decimal places
            averageRating: avgRating._avg.rating ? parseFloat(avgRating._avg.rating.toFixed(2)) : 0,
            totalReviews: avgRating._count.rating,
        };
    }

    // ** . UPDATE (Update Review) - PATCH **
    async update(id: string, updateReviewDto: UpdateReviewDto) {
        try {
            const updatedReview = await this.prisma.review.update({
                where: { id },
                // Use spread operator to update only provided fields
                data: {
                    // This works because updateReviewDto fields are optional/undefined if not sent
                    ...updateReviewDto,
                },
            });
            return updatedReview;
        } catch (error) {
            if (error.code === "P2025") {
                // Prisma error code for record not found
                throw new NotFoundException(`Review with ID ${id} not found.`);
            }
            throw error;
        }
    }

    // ** 4. DELETE (Delete Review) - DELETE **
    async remove(id: string) {
        try {
            // Prisma delete returns the deleted object
            const deletedReview = await this.prisma.review.delete({
                where: { id },
            });
            return deletedReview; // Returns the deleted object
        } catch (error) {
            if (error.code === "P2025") {
                throw new NotFoundException(`Review with ID ${id} not found.`);
            }
            throw error;
        }
    }
}
