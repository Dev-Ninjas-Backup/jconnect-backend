import { GetUser, ValidateUser } from "@common/jwt/jwt.decorator";
import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { follow_create_dto } from "./dto/follow_create.dto";
import { FollowFunctionService } from "./follow-function.service";

@ApiTags("Follow --------------------------- Function management")
@Controller("follow-function")
export class FollowFunctionController {
    constructor(private readonly followFunctionService: FollowFunctionService) {}

    @ApiBearerAuth()
    @ValidateUser()
    @ApiOperation({ summary: "Follow or Unfollow a user" })
    @Post("follow")
    async follow(@Body() folowingdata: follow_create_dto, @GetUser() user: any) {
        return this.followFunctionService.follow(folowingdata, user);
    }
    // ------------------------------------------------------- added getFollowers endpoint -------------------------------------------------------
    @ApiBearerAuth()
    @ValidateUser()
    @ApiOperation({ summary: "Get followers of a user" })
    @Get("followers")
    async getFollowers(@GetUser() user: any) {
        return this.followFunctionService.getFollowers(user);
    }

    // ------------------follow status----------------------
    @ApiBearerAuth()
    @ValidateUser()
    @ApiOperation({ summary: "Check if a user is following another user" })
    @Get("status/:id")
    async followStatus(@GetUser() user: any, @Param("id") userIdToCheck: string) {
        return this.followFunctionService.followStatus(user, userIdToCheck);
    }
    // ------------------------------------------------------- update: added getFollowings endpoint -------------------------------------------------------
    @ApiBearerAuth()
    @ValidateUser()
    @ApiOperation({ summary: "Get followings of a user" })
    @Get("followings")
    async getFollowings(@GetUser() user: any) {
        return this.followFunctionService.getFollowing(user);
    }
}
