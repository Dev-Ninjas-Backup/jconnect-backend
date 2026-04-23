import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors,
} from "@nestjs/common";

import { CreateDisputeDto } from "./dto/create-dispute.dto";
import { UpdateDisputeDto } from "./dto/update-dispute.dto";

import { GetUser, ValidateAdmin, ValidateUser } from "@common/jwt/jwt.decorator";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from "@nestjs/swagger";
import { DisputeService } from "./dispotch.service";
import { FindDisputesDto } from "./dto/find-disputes.dto";

@ApiTags("disputes")
@ApiBearerAuth()
@Controller("disputes")
export class DisputeController {
    constructor(private readonly disputeService: DisputeService) {}

    @ValidateUser()
    @Post()
    @ApiOperation({ summary: "Create a new dispute with file upload" })
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                orderId: { type: "string" },
                description: { type: "string" },
                resolution: { type: "string" },
                files: {
                    type: "array",
                    items: { type: "string", format: "binary" },
                },
            },
        },
    })
    @UseInterceptors(FilesInterceptor("files"))
    create(
        @GetUser() user: any,
        @UploadedFiles() files: Express.Multer.File[],
        @Body() dto: CreateDisputeDto,
    ) {
        return this.disputeService.create(user.userId, dto, files);
    }

    @ApiBearerAuth()
    @ValidateAdmin()
    @Get()
    @ApiOperation({ summary: "Get all disputes (admin)" })
    @ApiQuery({
        name: "search",
        required: false,
        type: String,
        description: "Search by dispute ID or order ID",
    })
    findAll(@Query("search") search?: string) {
        return this.disputeService.findAll(search);
    }

    @ApiBearerAuth()
    @ValidateAdmin()
    @Get("filter")
    @ApiOperation({ summary: "Get all disputes (admin) with filtering & pagination" })
    @ApiQuery({
        name: "search",
        required: false,
        type: String,
        description: "Search by dispute ID or order ID",
    })
    async findQuery(@Query() query: FindDisputesDto, @Query("search") search?: string) {
        try {
            const result = await this.disputeService.findQuery(query, search);
            return {
                ...result,
                success: true,
                message: "Disputes fetched successfully",
            };
        } catch (error) {
            throw new BadRequestException(error?.message || "Failed to fetch disputes");
        }
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get("my")
    @ApiOperation({ summary: "Get current user disputes" })
    findMy(@GetUser() user: any) {
        return this.disputeService.findMyDisputes(user.userId);
    }

    @ApiBearerAuth()
    @ValidateAdmin()
    @Get(":id")
    findOne(@Param("id") id: string) {
        return this.disputeService.findOne(id);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Patch(":id")
    @ApiOperation({
        summary: "Update dispute status/resolution (admin) REJECTED RESOLVED UNDER_REVIEW",
    })
    update(@Param("id") id: string, @Body() dto: UpdateDisputeDto, @GetUser() user: any) {
        return this.disputeService.update(id, dto, user);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Delete(":id")
    remove(@Param("id") id: string, @GetUser() user: any) {
        return this.disputeService.remove(id, user);
    }
}
