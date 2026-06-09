import { GetUser, ValidateUser } from "@common/jwt/jwt.decorator";
import { AwsService } from "@main/aws/aws.service";
import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiQuery,
    ApiTags,
} from "@nestjs/swagger";
import { RepostOrderStatus } from "@prisma/client";
import { CreateRepostOrderDto, ReviewActionDto, SubmitProofDto } from "./dto/repost-order.dto";
import { RepostOrderService } from "./repost-order.service";

@ApiTags("Repost Orders")
@ApiBearerAuth()
@Controller("repost-orders")
export class RepostOrderController {
    constructor(
        private readonly service: RepostOrderService,
        private readonly awsService: AwsService,
    ) {}

    @ValidateUser()
    @Post()
    @ApiOperation({ summary: "Buyer: create a repost order" })
    create(@GetUser() user: any, @Body() dto: CreateRepostOrderDto) {
        return this.service.create(user.userId, dto);
    }

    @ValidateUser()
    @Post(":id/accept")
    @ApiOperation({ summary: "Seller: accept a repost request" })
    accept(@Param("id") id: string, @GetUser() user: any) {
        return this.service.sellerRespond(id, user.userId, true);
    }

    @ValidateUser()
    @Post(":id/reject")
    @ApiOperation({ summary: "Seller: reject a repost request" })
    reject(@Param("id") id: string, @GetUser() user: any) {
        return this.service.sellerRespond(id, user.userId, false);
    }

    @ValidateUser()
    @Post(":id/submit-proof")
    @ApiOperation({ summary: "Seller: submit proof (file upload or URL)" })
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                proofType: { type: "string", enum: ["SCREENSHOT", "SCREEN_RECORDING", "URL"] },
                proofUrl: { type: "string", description: "Required when proofType is URL" },
                files: { type: "array", items: { type: "string", format: "binary" } },
            },
            required: ["proofType"],
        },
    })
    @UseInterceptors(FilesInterceptor("files", 5))
    async submitProof(
        @Param("id") id: string,
        @GetUser() user: any,
        @Body() dto: SubmitProofDto,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
        if (dto.proofType !== "URL" && (!files || files.length === 0))
            throw new BadRequestException(
                "File is required for SCREENSHOT or SCREEN_RECORDING proof",
            );

        const uploadedUrls: string[] = [];
        if (files?.length) {
            for (const file of files) {
                const res = await this.awsService.upload(file);
                uploadedUrls.push(res.url);
            }
        }

        return this.service.submitProof(id, user.userId, dto, uploadedUrls);
    }

    @ValidateUser()
    @Post(":id/review")
    @ApiOperation({ summary: "Buyer: accept / reject / request redo on submitted proof" })
    reviewProof(@Param("id") id: string, @GetUser() user: any, @Body() dto: ReviewActionDto) {
        return this.service.reviewProof(id, user.userId, dto);
    }

    @ValidateUser()
    @Get("my-orders")
    @ApiOperation({ summary: "Buyer: get my repost orders" })
    @ApiQuery({ name: "status", enum: RepostOrderStatus, required: false })
    myOrders(@GetUser() user: any, @Query("status") status?: RepostOrderStatus) {
        return this.service.getBuyerOrders(user.userId, status);
    }

    @ValidateUser()
    @Get("my-seller-orders")
    @ApiOperation({ summary: "Seller: get orders for my listings" })
    @ApiQuery({ name: "status", enum: RepostOrderStatus, required: false })
    mySellerOrders(@GetUser() user: any, @Query("status") status?: RepostOrderStatus) {
        return this.service.getSellerOrders(user.userId, status);
    }

    @ValidateUser()
    @Get(":id")
    @ApiOperation({ summary: "Get a single repost order with time remaining" })
    getOne(@Param("id") id: string) {
        return this.service.getOne(id);
    }
}
