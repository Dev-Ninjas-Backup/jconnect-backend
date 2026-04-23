import { ValidateUser } from "@common/jwt/jwt.decorator";
import { Body, Controller, Delete, Get, Param, Patch, Post } from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiExcludeController,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { CustomServiceRequest } from "@prisma/client";
import { CustomServiceRequestService } from "./custom-service-request.service";
import { CreateCustomRequestDto } from "./dto/create-custom-request.dto";
import { UpdateCustomRequestDto } from "./dto/update-custom-request.dto";
import { serviceGateway } from "./service-socket/serviceGateway";

@ApiExcludeController()
@ApiTags("Custom Service Requests")
@Controller("custom-requests")
export class CustomServiceRequestController {
    constructor(
        private readonly customRequestService: CustomServiceRequestService,
        private readonly serviceGateway: serviceGateway,
    ) {}

    @ApiBearerAuth()
    @ValidateUser()
    @Post()
    @ApiOperation({ summary: "Send a new custom service request to a creator/platform." })
    @ApiResponse({ status: 201, description: "Custom request created successfully." })
    async create(@Body() createDto: CreateCustomRequestDto): Promise<CustomServiceRequest> {
        const newRequest = await this.customRequestService.create(createDto);

        // Emit socket event for real-time updates
        this.serviceGateway.emitServiceCreated(newRequest);

        return newRequest;
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get()
    @ApiOperation({ summary: "Get all custom requests (admin/creator view)." })
    @ApiResponse({ status: 200, description: "List of all custom requests." })
    async findAll(): Promise<CustomServiceRequest[]> {
        const requests = await this.customRequestService.findAll();

        // Emit socket event for real-time list fetch (broadcast to all users)
        this.serviceGateway.emitServiceListFetched(null, requests);

        return requests;
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get(":id")
    @ApiOperation({ summary: "Get a specific custom request by ID." })
    @ApiResponse({ status: 200, description: "Request found." })
    @ApiResponse({ status: 404, description: "Request not found." })
    async findOne(@Param("id") id: string): Promise<CustomServiceRequest> {
        const request = await this.customRequestService.findOne(id);

        // Note: For findOne via REST, we don't emit socket events as it's a read operation
        // Socket events are emitted only for the socket-based fetch in the gateway

        return request;
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Patch(":id")
    @ApiOperation({ summary: "Update custom request (e.g., add quote, change status)." })
    @ApiResponse({ status: 200, description: "Request updated successfully." })
    @ApiResponse({ status: 404, description: "Request not found." })
    async update(
        @Param("id") id: string,
        @Body() updateDto: UpdateCustomRequestDto,
    ): Promise<CustomServiceRequest> {
        const updated = await this.customRequestService.update(id, updateDto);

        // Emit socket event for real-time updates
        this.serviceGateway.emitServiceUpdated(updated);

        return updated;
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Delete(":id")
    @ApiOperation({ summary: "Cancel or delete a custom service request." })
    @ApiResponse({ status: 200, description: "Request deleted successfully." })
    @ApiResponse({ status: 404, description: "Request not found." })
    async remove(@Param("id") id: string): Promise<CustomServiceRequest> {
        const deleted = await this.customRequestService.remove(id);

        // Emit socket event for real-time updates
        this.serviceGateway.emitServiceDeleted(deleted);

        return deleted;
    }
}
