import { HandleError } from "@common/error/handle-error.decorator";
import { FirebaseNotificationService } from "@main/shared/notification/firebase-notification.service";
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { NotificationType } from "src/lib/firebase/dto/notification.dto";
import { MailService } from "src/lib/mail/mail.service";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { follow_create_dto } from "./dto/follow_create.dto";

@Injectable()
export class FollowFunctionService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly eventEmitter: EventEmitter2,
        private readonly firebaseNotificationService: FirebaseNotificationService,
        private readonly mailService: MailService,
    ) {}

    //------------------- Follow or Unfollow a user-------------------//
    @HandleError("Error in follow function")
    async follow(folowingdata: follow_create_dto, user: any) {
        if (user.userId === folowingdata.followingID) {
            return { message: "you can't follow yourself" };
        }

        const userexist = await this.prisma.user.findUnique({
            where: {
                id: folowingdata.followingID,
            },
        });

        if (!userexist) {
            return { message: "user to follow not found" };
        }
        const existfollowed = await this.prisma.follow.findFirst({
            where: {
                followerId: user.userId,
                followingId: folowingdata.followingID,
            },
        });

        if (existfollowed) {
            await this.prisma.follow.delete({
                where: {
                    id: existfollowed.id,
                },
            });

            return { message: "unfollowed successfully" };
        }

        const following = await this.prisma.follow.create({
            data: {
                followerId: user.userId,
                followingId: folowingdata.followingID,
            },
        });

        //------------------ Send follow notification ------------------//
        await this.firebaseNotificationService.sendToUser(
            folowingdata.followingID,
            {
                title: `${user.username} started following you`,
                body: `${user.username} started following you so you can follow them back and connect with them!`,
                type: NotificationType.NEW_FOLLOWER,
                data: {
                    followerId: user.userId,
                    timestamp: new Date().toISOString(),
                },
            },
            true,
        );
        console.log(` Follow notification sent to user ${folowingdata.followingID}`);

        //------------------ Send follow email ------------------//
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
                            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
                        .follower-box {
                            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
                            border: 2px solid #667eea;
                            padding: 25px;
                            text-align: center;
                            margin: 30px 0;
                            border-radius: 10px;
                        }
                        .follower-name {
                            font-size: 24px;
                            font-weight: bold;
                            color: #667eea;
                            margin: 15px 0;
                        }
                        .info-box {
                            background: #dbeafe;
                            border-left: 4px solid #667eea;
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
                            color: #667eea;
                            font-weight: 600;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="header">
                            <div class="logo">👤 DjConnect</div>
                            <div class="header-subtitle">New Follower Alert</div>
                        </div>
                        <div class="content">
                            <h2 style="color: #1e293b; margin-bottom: 20px;">Great News! 🎉</h2>
                            <p style="font-size: 16px; color: #475569;">Someone new started following you on <span class="brand-name">DaConnect</span>!</p>
                            
                            <div class="follower-box">
                                <p style="margin: 0; font-size: 14px; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">New Follower</p>
                                <div class="follower-name">${user.username}</div>
                                <p style="margin: 10px 0 0 0; font-size: 14px; color: #64748b;">${user.full_name || "A DaConnect User"}</p>
                            </div>
                            
                            <div class="info-box">
                                <strong style="color: #667eea;">💡 Did you know?</strong> You now have more ways to connect with your followers. Follow them back to build a mutual connection!
                            </div>
                            
                            <p style="font-size: 14px; color: #64748b; margin-top: 25px;">Grow your network and engage with your community on DaConnect. Every follower brings new opportunities for collaboration and connection.</p>
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
                userexist.email,
                `👤 ${user.username} started following you on DaConnect`,
                emailHtml,
            );
            console.log(`📧 Follow email sent to ${userexist.email}`);
        } catch (error) {
            console.error(` Failed to send follow email: ${error.message}`);
        }

        return { message: "followed successfully", data: following };
    }

    //--------------- follow status a user check i following another user or not -------------------//
    @HandleError("Error in follow status function")
    async followStatus(user: any, userIdToCheck: string) {
        const isFollowing = await this.prisma.follow.findFirst({
            where: {
                followerId: user.userId,
                followingId: userIdToCheck,
            },
        });

        return { data: { isFollowing: !!isFollowing } };
    }

    //------------------- Get followers of a user-------------------//

    @HandleError("Error in get followers function")
    async getFollowers(user: any) {
        const followers = await this.prisma.follow.findMany({
            where: {
                followingId: user.userId,
            },
            include: {
                followers: {
                    select: {
                        id: true,
                        email: true,
                        full_name: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
            },
        });

        return { data: { followers, count: followers.length } };
    }

    //------------------- Get followings of a user-------------------//
    @HandleError("Error in get following function")
    async getFollowing(user: any) {
        const following = await this.prisma.follow.findMany({
            where: {
                followerId: user.userId,
            },
            include: {
                following: {
                    select: {
                        id: true,
                        email: true,
                        full_name: true,
                        username: true,
                        profilePhoto: true,
                    },
                },
            },
        });

        return { data: { following, count: following.length } };
    }
}
