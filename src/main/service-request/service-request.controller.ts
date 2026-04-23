import { GetUser, ValidateUser } from "@common/jwt/jwt.decorator";
import {
    Body,
    Controller,
    Get,
    Param,
    Patch,
    Post,
    Query,
    UploadedFiles,
    UseInterceptors,
} from "@nestjs/common";
import { FileFieldsInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiProperty,
    ApiQuery,
    ApiTags,
} from "@nestjs/swagger";
import { CreateServiceRequestDto } from "./dto/create-service-request.dto";
import { ServiceRequestService } from "./service-request.service";

@ApiTags("Service Requests")
@Controller("service-requests")
export class ServiceRequestController {
    constructor(private readonly serviceRequestService: ServiceRequestService) {}

    @ApiBearerAuth()
    @ValidateUser()
    @Post()
    @ApiConsumes("multipart/form-data")
    @UseInterceptors(
        FileFieldsInterceptor([{ name: "files", maxCount: 5 }], {
            storage: memoryStorage(),
            limits: { fileSize: 500 * 1024 * 1024 },
        }),
    )
    @ApiBody({
        description: "Create Service Request",
        schema: {
            type: "object",
            properties: {
                serviceId: { type: "string" },
                captionOrInstructions: { type: "string" },
                promotionDate: { type: "string", format: "date-time" },
                specialNotes: { type: "string" },
                price: { type: "number" },
                files: {
                    nullable: true,
                    type: "array",
                    items: { type: "string", format: "binary" }, // important for Swagger file
                },
                messageID: { type: "string" },
            },
        },
    })
    async create(
        @Body() dto: CreateServiceRequestDto,
        @GetUser() user: any,
        @UploadedFiles() files: { files?: Express.Multer.File[] },
    ) {
        return this.serviceRequestService.create(dto, files.files || [], user);
    }

    @ApiProperty({ description: "Get all service requests" })
    @Get()
    async findAll() {
        return this.serviceRequestService.findAll();
    }

    @ApiProperty({ description: "Test AWS S3 connection" })
    @Get("test/aws-connection")
    async testAWSConnection() {
        return this.serviceRequestService.testAWSConnection();
    }

    @ApiProperty({ description: "Get service requests", example: "id" })
    @Get(":id")
    async findOne(@Param("id") id: string) {
        return this.serviceRequestService.findOne(id);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Patch(":id/is-paid")
    @ApiQuery({
        name: "isPaid",
        description: "Payment status of the service request",
        required: true,
        type: Boolean,
        example: true,
    })
    async updateIsPaid(@Param("id") id: string, @Query("isPaid") isPaid: string) {
        const isPaidBoolean = isPaid === "true" || isPaid === "1";
        return this.serviceRequestService.updateIsPaid(id, isPaidBoolean);
    }

    // ----------------- decline or accept service request-----------------
    @ApiOperation({ summary: "Decline or accept a service request" })
    @ApiBearerAuth()
    @ValidateUser()
    @Patch(":id/is-declined")
    @ApiQuery({
        name: "isDeclined",
        description: "Decline status of the service request",
        required: false,
        type: Boolean,
        example: false,
    })
    @ApiQuery({
        name: "isAccepted",
        description: "Accept status of the service request",
        required: false,
        type: Boolean,
        example: true,
    })
    async updateIsDeclined(
        @Param("id") id: string,
        @Query("isDeclined") isDeclined?: string,
        @Query("isAccepted") isAccepted?: string,
    ) {
        const updateData: { isDeclined?: boolean; isAccepted?: boolean } = {};

        if (isDeclined !== undefined) {
            updateData.isDeclined = isDeclined === "true" || isDeclined === "1";
        }

        if (isAccepted !== undefined) {
            updateData.isAccepted = isAccepted === "true" || isAccepted === "1";
        }

        return this.serviceRequestService.updateIsDeclined(id, updateData);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Patch(":id/uploaded-files")
    @ApiConsumes("multipart/form-data")
    @UseInterceptors(
        FileFieldsInterceptor([{ name: "files", maxCount: 5 }], {
            storage: memoryStorage(),
            limits: { fileSize: 500 * 1024 * 1024 },
        }),
    )
    @ApiBody({
        description:
            "Update uploaded files (deletes old files and uploads new ones, sets isDeclined to false)",
        schema: {
            type: "object",
            properties: {
                files: {
                    nullable: true,
                    type: "array",
                    items: { type: "string", format: "binary" },
                },
            },
        },
    })
    async updateUploadedFiles(
        @Param("id") id: string,
        @GetUser() user: any,
        @UploadedFiles() files: { files?: Express.Multer.File[] },
    ) {
        return this.serviceRequestService.updateUploadedFiles(id, files.files || [], user);
    }
}
