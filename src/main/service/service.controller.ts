import { GetUser, ValidateArtist, ValidateUser } from "@common/jwt/jwt.decorator";
import { AwsService } from "@main/aws/aws.service";
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
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { Service, ServiceType, SocialLogo } from "@prisma/client";
import { CreateServiceDto, UpdateServiceDto } from "./dto/create-service.dto";

import { ServiceService } from "./service.service";

@ApiTags("Services-all -details")
@Controller("services")
export class ServiceController {
    constructor(
        private readonly serviceService: ServiceService,
        private readonly awsService: AwsService,
    ) {}

    @ApiBearerAuth()
    @ValidateArtist()
    @Post()
    @ApiOperation({ summary: "Create a new service listing" })
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        description: "Create Service",
        schema: {
            type: "object",
            properties: {
                serviceName: { type: "string" },
                serviceType: {
                    type: "string",
                    enum: [ServiceType.SOCIAL_POST, ServiceType.SERVICE],
                    example: ServiceType.SERVICE,
                },
                description: { type: "string" },
                price: { type: "number" },
                currency: { type: "string" },
                isCustom: { type: "boolean" },
                isPost: { type: "boolean" },
                files: {
                    nullable: true,
                    type: "array",
                    items: { type: "string", format: "binary" },
                },
                socialLogoForSocialService: {
                    nullable: true,
                    type: "string",
                    format: "binary",
                    description: "Social media logo for social service posts",
                },
                socialLogo: {
                    type: "string",
                    enum: Object.values(SocialLogo),
                    example: SocialLogo.FACEBOOK,
                    description: "Select social media platform type",
                    nullable: true,
                },
            },
            required: ["serviceName", "serviceType", "price"],
        },
    })
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: "files", maxCount: 5 },
            { name: "socialLogoForSocialService", maxCount: 1 },
        ]),
    )
    @ApiResponse({ status: 201, description: "Service created successfully" })
    async create(
        @Body() createServiceDto: CreateServiceDto,
        @GetUser() user: any,
        @UploadedFiles()
        files?: {
            files?: Express.Multer.File[];
            socialLogoForSocialService?: Express.Multer.File[];
        },
    ): Promise<Service> {
        // Upload social logo to S3 if provided
        if (files?.socialLogoForSocialService?.[0]) {
            const uploadResult = await this.awsService.upload(files.socialLogoForSocialService[0]);
            createServiceDto.socialLogoForSocialService = uploadResult.url;
        }
        return this.serviceService.create(createServiceDto, user);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get()
    @ApiOperation({ summary: "Get all available services" })
    @ApiResponse({ status: 200, description: "List of all services" })
    findAll(): Promise<Service[]> {
        return this.serviceService.findAll();
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get("my_service")
    @ApiOperation({ summary: "Get available services" })
    @ApiResponse({ status: 200, description: "List of all services" })
    MyService(@GetUser() user: any): Promise<Service[]> {
        return this.serviceService.Myservice(user);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get(":id")
    @ApiOperation({ summary: "Get service details by ID" })
    @ApiResponse({ status: 200, description: "Service details found" })
    @ApiResponse({ status: 404, description: "Service not found" })
    findOne(@Param("id") id: string, @GetUser() user: any) {
        return this.serviceService.findOne(id);
    }

    @ApiBearerAuth()
    @ValidateArtist()
    @Patch(":id")
    @ApiOperation({ summary: "Update an existing service" })
    @ApiConsumes("multipart/form-data")
    @ApiBody({
        description: "Update Service",
        schema: {
            type: "object",
            properties: {
                serviceName: { type: "string" },
                serviceType: {
                    type: "string",
                    enum: [ServiceType.SOCIAL_POST, ServiceType.SERVICE],
                    example: ServiceType.SERVICE,
                },
                description: { type: "string" },
                price: { type: "number" },
                currency: { type: "string" },
                isCustom: { type: "boolean" },
                isPost: { type: "boolean" },
                files: {
                    nullable: true,
                    type: "array",
                    items: { type: "string", format: "binary" },
                },
                socialLogoForSocialService: {
                    nullable: true,
                    type: "string",
                    format: "binary",
                    description: "Social media logo for social service posts",
                },
                socialLogo: {
                    type: "string",
                    enum: Object.values(SocialLogo),
                    example: SocialLogo.FACEBOOK,
                    description: "Select social media platform type",
                    nullable: true,
                },
            },
        },
    })
    @UseInterceptors(
        FileFieldsInterceptor([
            { name: "files", maxCount: 5 },
            { name: "socialLogoForSocialService", maxCount: 1 },
        ]),
    )
    @ApiResponse({ status: 200, description: "Service updated successfully" })
    async update(
        @Param("id") id: string,
        @Body() updateServiceDto: UpdateServiceDto,
        @GetUser() user: any,
        @UploadedFiles()
        files?: {
            files?: Express.Multer.File[];
            socialLogoForSocialService?: Express.Multer.File[];
        },
    ) {
        // Upload social logo to S3 if provided
        if (files?.socialLogoForSocialService?.[0]) {
            const uploadResult = await this.awsService.upload(files.socialLogoForSocialService[0]);
            updateServiceDto.socialLogoForSocialService = uploadResult.url;
        }
        return this.serviceService.update(id, updateServiceDto, user);
    }

    @ApiBearerAuth()
    @ValidateArtist()
    @Delete(":id")
    @ApiOperation({ summary: "Delete a service listing by ID" })
    @ApiResponse({ status: 200, description: "Service deleted successfully" })
    @ApiResponse({ status: 404, description: "Service not found" })
    remove(@Param("id") id: string, @GetUser() user: any): Promise<Service> {
        return this.serviceService.remove(id);
    }
}
