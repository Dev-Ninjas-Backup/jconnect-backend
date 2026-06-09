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
import { GetUser, ValidateArtist, ValidateUser } from "@common/jwt/jwt.decorator";
import { AwsService } from "@main/aws/aws.service";
import { SocialServiceService } from "./social-service.service";
import { CreateSocialServiceDto, UpdateSocialServiceDto } from "./dto/create-social-service.dto";

@ApiTags("Social Service")
@ApiBearerAuth()
@Controller("social-service")
export class SocialServiceController {
    constructor(
        private readonly socialService: SocialServiceService,
        private readonly awsService: AwsService,
    ) {}

    @ValidateArtist()
    @Post()
    @ApiOperation({ summary: "Create a social service listing (Artist only)" })
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: "object",
            required: ["serviceName", "platforms", "artistName", "price", "preferredDeliveryDate"],
            properties: {
                serviceName: { type: "string", example: "Instagram Promotion" },
                platforms: {
                    type: "array",
                    items: { type: "string" },
                    example: ["Instagram", "YouTube"],
                },
                artistName: { type: "string", example: "John Doe" },
                price: { type: "number", example: 150 },
                preferredDeliveryDate: {
                    type: "string",
                    format: "date-time",
                    example: "2025-12-15T00:00:00Z",
                },
                specialNotes: {
                    type: "string",
                    example: "Please deliver before Christmas",
                    nullable: true,
                },
                status: { type: "string", example: "Pending", nullable: true },
                attachedFiles: {
                    type: "array",
                    items: { type: "string", format: "binary" },
                    description: "Upload up to 10 files (images, videos, documents)",
                },
            },
        },
    })
    @UseInterceptors(FilesInterceptor("attachedFiles", 10))
    async create(
        @GetUser() user: any,
        @Body() dto: CreateSocialServiceDto,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
        const uploadedUrls = await this.uploadFiles(files);
        return this.socialService.create({
            ...dto,
            artistID: user.userId,
            attachedFiles: uploadedUrls,
        });
    }

    @ValidateUser()
    @Get()
    @ApiOperation({ summary: "Get all social service listings" })
    findAll() {
        return this.socialService.findAll();
    }

    @ValidateArtist()
    @Get("my-listings")
    @ApiOperation({ summary: "Get my social service listings" })
    myListings(@GetUser() user: any) {
        return this.socialService.findByArtist(user.userId);
    }

    @ValidateUser()
    @Get(":id")
    @ApiOperation({ summary: "Get social service listing by ID" })
    findOne(@Param("id") id: string) {
        return this.socialService.findOne(id);
    }

    @ValidateArtist()
    @Patch(":id")
    @ApiOperation({
        summary: "Update a social service listing (replaces attached files if provided)",
    })
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                serviceName: { type: "string" },
                platforms: { type: "array", items: { type: "string" } },
                artistName: { type: "string" },
                price: { type: "number" },
                preferredDeliveryDate: { type: "string", format: "date-time" },
                specialNotes: { type: "string", nullable: true },
                status: { type: "string" },
                attachedFiles: {
                    type: "array",
                    items: { type: "string", format: "binary" },
                    description: "Upload new files (replaces existing ones)",
                    nullable: true,
                },
            },
        },
    })
    @UseInterceptors(FilesInterceptor("attachedFiles", 10))
    async update(
        @Param("id") id: string,
        @GetUser() user: any,
        @Body() dto: UpdateSocialServiceDto,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
        const uploadedUrls = await this.uploadFiles(files);
        const updateData: UpdateSocialServiceDto = { ...dto };
        if (uploadedUrls.length > 0) updateData.attachedFiles = uploadedUrls;
        return this.socialService.update(id, updateData, user.userId);
    }

    @ValidateArtist()
    @Delete(":id")
    @ApiOperation({ summary: "Delete a social service listing" })
    remove(@Param("id") id: string, @GetUser() user: any) {
        return this.socialService.remove(id, user.userId);
    }

    private async uploadFiles(files?: Express.Multer.File[]): Promise<string[]> {
        if (!files || files.length === 0) return [];
        const results = await Promise.all(files.map((f) => this.awsService.upload(f)));
        return results.map((r) => r.url);
    }
}
