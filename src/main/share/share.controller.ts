import { Controller, Get, Header, Param, Res } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { ShareService } from "./share.service";

@ApiTags("Share")
@Controller("share")
export class ShareController {
    constructor(private readonly shareService: ShareService) {}

    // ─── API endpoints called by the mobile app ──────────────────────────────

    @Get("link/profile/:userId")
    @ApiOperation({ summary: "Get shareable link info for a user profile" })
    @ApiParam({ name: "userId", description: "User ID" })
    @ApiResponse({ status: 200, description: "Shareable link data returned" })
    getProfileLink(@Param("userId") userId: string) {
        return this.shareService.getProfileShareLink(userId);
    }

    @Get("link/service/:serviceId")
    @ApiOperation({ summary: "Get shareable link info for a service/project" })
    @ApiParam({ name: "serviceId", description: "Service ID" })
    @ApiResponse({ status: 200, description: "Shareable link data returned" })
    getServiceLink(@Param("serviceId") serviceId: string) {
        return this.shareService.getServiceShareLink(serviceId);
    }

    // ─── OG pages served when the shared URL is opened ───────────────────────

    @Get("profile/:userId")
    @Header("Content-Type", "text/html; charset=utf-8")
    @ApiOperation({ summary: "Open Graph preview page for a user profile" })
    @ApiParam({ name: "userId", description: "User ID" })
    async profilePage(@Param("userId") userId: string, @Res() res: Response) {
        const html = await this.shareService.renderProfilePage(userId);
        res.send(html);
    }

    @Get("service/:serviceId")
    @Header("Content-Type", "text/html; charset=utf-8")
    @ApiOperation({ summary: "Open Graph preview page for a service/project" })
    @ApiParam({ name: "serviceId", description: "Service ID" })
    async servicePage(@Param("serviceId") serviceId: string, @Res() res: Response) {
        const html = await this.shareService.renderServicePage(serviceId);
        res.send(html);
    }
}
