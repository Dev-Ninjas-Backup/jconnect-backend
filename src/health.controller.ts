import { Controller, Get, Res } from "@nestjs/common";
import appMetadata from "@metadata/app-metadata";
import { ApiOkResponse } from "@nestjs/swagger";
import type { Response } from "express";

@Controller()
export class HealthController {
    @ApiOkResponse({
        description: "Returns service health status for monitoring",
        schema: {
            example: {
                status: "healthy",
                timestamp: "2025-05-27T12:00:00.000Z",
                version: "0.3.1",
                uptime: 3600,
            },
        },
    })
    @Get("api/health")
    health(@Res() res: Response) {
        res.status(200).json({
            status: "ok",
            name: appMetadata.displayName,
            version: appMetadata.version,
            description: appMetadata.description,
            environment: process.env.NODE_ENV,
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            team: {
                name: "Dev Ninja",
                leader: "Niloy",
                members: [
                    {
                        name: "Sabbir Hossain Shuvo",
                        role: "Software Engineer & Content Creator",
                        avatar: "https://avatars.githubusercontent.com/u/82939905?v=4",
                        url: "https://api.github.com/users/devlopersabbir",
                    },
                    {
                        name: "Mohammad Sobuj",
                        role: "Full-stack web developer👨‍💻",
                        avatar: "https://avatars.githubusercontent.com/u/72593531?v=4",
                        url: "https://api.github.com/users/coderboysobuj",
                    },
                ],
            },
        });
    }
}
