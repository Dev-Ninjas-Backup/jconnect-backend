import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { UAParser } from "ua-parser-js";

export interface DeviceInfo {
    browser?: string;
    browserVersion?: string;
    os?: string;
    osVersion?: string;
    deviceType?: string;
    deviceModel?: string;
    ipAddress?: string;
}

@Injectable()
export class DeviceService {
    private readonly logger = new Logger(DeviceService.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * Parse User-Agent string and extract device information
     */
    parseUserAgent(userAgent: string): DeviceInfo {
        const parser = new UAParser(userAgent);
        const result = parser.getResult();

        return {
            browser: result.browser.name || "Unknown",
            browserVersion: result.browser.version || "Unknown",
            os: result.os.name || "Unknown",
            osVersion: result.os.version || "Unknown",
            deviceType: result.device.type || "desktop",
            deviceModel: result.device.model || result.device.vendor || "Unknown",
        };
    }

    /**
     * Save or update device information for a user
     */
    async saveDeviceInfo(userId: string, userAgent: string, ipAddress: string): Promise<void> {
        try {
            const deviceInfo = this.parseUserAgent(userAgent);

            // Check if device already exists (by browser, os, and IP)
            const existingDevice = await this.prisma.device.findFirst({
                where: {
                    userId,
                    browser: deviceInfo.browser,
                    os: deviceInfo.os,
                    ipAddress,
                },
            });

            if (existingDevice) {
                // Update existing device's last used timestamp
                await this.prisma.device.update({
                    where: { id: existingDevice.id },
                    data: {
                        lastUsedAt: new Date(),
                        browserVersion: deviceInfo.browserVersion,
                        osVersion: deviceInfo.osVersion,
                    },
                });

                this.logger.log(
                    `📱 Updated device info for user ${userId} - ${deviceInfo.browser} on ${deviceInfo.os}`,
                );
            } else {
                // Create new device record
                await this.prisma.device.create({
                    data: {
                        userId,
                        browser: deviceInfo.browser,
                        browserVersion: deviceInfo.browserVersion,
                        os: deviceInfo.os,
                        osVersion: deviceInfo.osVersion,
                        deviceType: deviceInfo.deviceType,
                        deviceModel: deviceInfo.deviceModel,
                        ipAddress,
                        lastUsedAt: new Date(),
                    },
                });

                this.logger.log(
                    `📱 Created new device record for user ${userId} - ${deviceInfo.browser} on ${deviceInfo.os}`,
                );
            }
        } catch (error) {
            this.logger.error(`❌ Failed to save device info for user ${userId}:`, error);
            throw error;
        }
    }

    /**
     * Get all devices for a user
     */
    async getUserDevices(userId: string) {
        return this.prisma.device.findMany({
            where: { userId },
            orderBy: { lastUsedAt: "desc" },
        });
    }

    /**
     * Remove a specific device
     */
    async removeDevice(userId: string, deviceId: string) {
        return this.prisma.device.delete({
            where: {
                id: deviceId,
                userId, // Ensure user owns the device
            },
        });
    }

    /**
     * Remove all devices for a user (logout from all devices)
     */
    async removeAllUserDevices(userId: string) {
        return this.prisma.device.deleteMany({
            where: { userId },
        });
    }

    /**
     * Get device count for a user
     */
    async getDeviceCount(userId: string): Promise<number> {
        return this.prisma.device.count({
            where: { userId },
        });
    }

    /**
     * Clean up old devices (not used in last 90 days)
     */
    async cleanupOldDevices(daysInactive: number = 90) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysInactive);

        const result = await this.prisma.device.deleteMany({
            where: {
                lastUsedAt: {
                    lt: cutoffDate,
                },
            },
        });

        this.logger.log(
            `🧹 Cleaned up ${result.count} inactive devices (older than ${daysInactive} days)`,
        );

        return result.count;
    }
}
