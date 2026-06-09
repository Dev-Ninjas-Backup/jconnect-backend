import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Patch,
    Post,
    UploadedFiles,
    UseInterceptors,
} from "@nestjs/common";
import { FilesInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ValidateUser } from "@common/jwt/jwt.decorator";
import { AwsService } from "@main/aws/aws.service";
import {
    CreateSocialServiceRequestDto,
    UpdateSocialServiceRequestDto,
} from "./dto/create-social-service-request.dto";
import { SocialServiceRequestService } from "./social-service-request.service";

@ApiTags("Social Service Requests")
@ApiBearerAuth()
@Controller("social-service-request")
export class SocialServiceRequestController {
    constructor(
        private readonly service: SocialServiceRequestService,
        private readonly awsService: AwsService,
    ) {}

    @ValidateUser()
    @Post()
    @ApiOperation({ summary: "Create a social service request (with optional file attachments)" })
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: "object",
            required: [
                "serviceName",
                "socialServiceId",
                "platforms",
                "artistName",
                "price",
                "preferredDeliveryDate",
                "buyerId",
                "artistID",
            ],
            properties: {
                serviceName: { type: "string", example: "Instagram Shoutout" },
                socialServiceId: { type: "string", example: "svc_12345" },
                platforms: {
                    type: "array",
                    items: { type: "string" },
                    example: ["Instagram", "YouTube"],
                },
                artistName: { type: "string", example: "John Doe" },
                price: { type: "number", example: 150.5 },
                preferredDeliveryDate: {
                    type: "string",
                    format: "date-time",
                    example: "2025-11-15T00:00:00Z",
                },
                specialNotes: {
                    type: "string",
                    example: "Please make it look organic",
                    nullable: true,
                },
                buyerId: { type: "string", example: "buyer-uuid-123" },
                artistID: { type: "string", example: "artist-uuid-456" },
                attachedFiles: {
                    type: "array",
                    items: { type: "string", format: "binary" },
                    description: "Upload up to 10 files (images, videos, documents)",
                    nullable: true,
                },
            },
        },
    })
    @UseInterceptors(FilesInterceptor("attachedFiles", 10))
    async create(
        @Body() dto: CreateSocialServiceRequestDto,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
        const uploadedUrls = await this.uploadFiles(files);
        return this.service.create({ ...dto, attachedFiles: uploadedUrls });
    }

    @ValidateUser()
    @Get()
    @ApiOperation({ summary: "Get all social service requests" })
    findAll() {
        return this.service.findAll();
    }

    @ValidateUser()
    @Get(":id")
    @ApiOperation({ summary: "Get social service request by ID" })
    findOne(@Param("id") id: string) {
        return this.service.findOne(id);
    }

    @ValidateUser()
    @Patch(":id")
    @ApiOperation({ summary: "Update a social service request (replaces files if provided)" })
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                serviceName: { type: "string" },
                socialServiceId: { type: "string" },
                platforms: { type: "array", items: { type: "string" } },
                artistName: { type: "string" },
                price: { type: "number" },
                preferredDeliveryDate: { type: "string", format: "date-time" },
                specialNotes: { type: "string", nullable: true },
                status: { type: "string" },
                attachedFiles: {
                    type: "array",
                    items: { type: "string", format: "binary" },
                    description: "Upload new files (replaces existing attachments)",
                    nullable: true,
                },
            },
        },
    })
    @UseInterceptors(FilesInterceptor("attachedFiles", 10))
    async update(
        @Param("id") id: string,
        @Body() dto: UpdateSocialServiceRequestDto,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
        const uploadedUrls = await this.uploadFiles(files);
        const updateData: UpdateSocialServiceRequestDto = { ...dto };
        if (uploadedUrls.length > 0) updateData.attachedFiles = uploadedUrls;
        return this.service.update(id, updateData);
    }

    @ValidateUser()
    @Delete(":id")
    @ApiOperation({ summary: "Delete a social service request" })
    remove(@Param("id") id: string) {
        return this.service.remove(id);
    }

    private async uploadFiles(files?: Express.Multer.File[]): Promise<string[]> {
        if (!files || files.length === 0) return [];
        const results = await Promise.all(files.map((f) => this.awsService.upload(f)));
        return results.map((r) => r.url);
    }
}
