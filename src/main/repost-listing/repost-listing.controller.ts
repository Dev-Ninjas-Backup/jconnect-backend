import { GetUser, ValidateArtist, ValidateUser } from "@common/jwt/jwt.decorator";
import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { RepostPlatform } from "@prisma/client";
import {
    CreateRepostListingDto,
    ToggleActiveDto,
    ToggleListingDto,
    UpdateRepostListingDto,
} from "./dto/repost-listing.dto";
import { RepostListingService } from "./repost-listing.service";

@ApiTags("Repost Listings")
@Controller("repost-listings")
export class RepostListingController {
    constructor(private readonly service: RepostListingService) {}

    @ApiBearerAuth()
    @ValidateArtist()
    @Post()
    @ApiOperation({ summary: "Create a repost listing (Artist only)" })
    create(@GetUser() user: any, @Body() dto: CreateRepostListingDto) {
        return this.service.create(user.userId, dto);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get()
    @ApiOperation({ summary: "Get all active repost listings (marketplace)" })
    @ApiQuery({ name: "platform", enum: RepostPlatform, required: false })
    @ApiQuery({ name: "spotlight", type: Boolean, required: false })
    findAll(@Query("platform") platform?: RepostPlatform, @Query("spotlight") spotlight?: string) {
        return this.service.findAll(platform, spotlight === "true");
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get("spotlight")
    @ApiOperation({ summary: "Get $1 Repost Spotlight listings" })
    getSpotlight() {
        return this.service.getSpotlightListings();
    }

    @ApiBearerAuth()
    @ValidateArtist()
    @Get("my-listings")
    @ApiOperation({ summary: "Get my repost listings" })
    @ApiQuery({ name: "status", enum: ["active", "inactive"], required: false })
    myListings(@GetUser() user: any, @Query("status") status?: "active" | "inactive") {
        return this.service.findBySeller(user.userId, status);
    }

    @ApiBearerAuth()
    @ValidateArtist()
    @Get("dashboard")
    @ApiOperation({ summary: "Seller dashboard: listings with order counts" })
    dashboard(@GetUser() user: any) {
        return this.service.getSellerDashboard(user.userId);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get("platforms")
    @ApiOperation({
        summary:
            "Get supported platforms + repost types (Repost Hub / Select Repost Option screens, and the create/edit listing form)",
    })
    getPlatforms() {
        return this.service.getPlatforms();
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get("following")
    @ApiOperation({ summary: "Get repost listings from sellers you follow" })
    findByFollowing(@GetUser() user: any) {
        return this.service.findByFollowing(user.userId);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get("artist/:artistId")
    @ApiOperation({
        summary: "Get another artist's public repost listings (viewing their profile)",
    })
    findByArtist(@Param("artistId") artistId: string) {
        return this.service.findByArtist(artistId);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get(":id")
    @ApiOperation({ summary: "Get repost listing by ID" })
    findOne(@Param("id") id: string) {
        return this.service.findOne(id);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Post(":id/pay")
    @ApiOperation({
        summary:
            "Buyer: pre-authorize payment for a listing (Screen 3 — Content & Payment 'Pay Now'). Returns a paymentIntentId to pass to POST /repost-orders.",
    })
    pay(@Param("id") id: string, @GetUser() user: any) {
        return this.service.pay(id, user.userId);
    }

    @ApiBearerAuth()
    @ValidateArtist()
    @Patch(":id")
    @ApiOperation({ summary: "Update a repost listing" })
    update(@Param("id") id: string, @GetUser() user: any, @Body() dto: UpdateRepostListingDto) {
        return this.service.update(id, user.userId, dto);
    }

    @ApiBearerAuth()
    @ValidateArtist()
    @Patch(":id/toggle-pause")
    @ApiOperation({ summary: "Pause or reactivate a listing" })
    togglePause(@Param("id") id: string, @GetUser() user: any, @Body() dto: ToggleListingDto) {
        return this.service.togglePause(id, user.userId, dto);
    }

    @ApiBearerAuth()
    @ValidateArtist()
    @Patch(":id/toggle-active")
    @ApiOperation({ summary: "Activate or deactivate a listing (sets isActive true/false)" })
    toggleActive(@Param("id") id: string, @GetUser() user: any, @Body() dto: ToggleActiveDto) {
        return this.service.toggleActive(id, user.userId, dto);
    }

    @ApiBearerAuth()
    @ValidateArtist()
    @Delete(":id")
    @ApiOperation({ summary: "Delete a repost listing" })
    remove(@Param("id") id: string, @GetUser() user: any) {
        return this.service.remove(id, user.userId);
    }
}
