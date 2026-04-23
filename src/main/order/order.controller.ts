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
    UploadedFile,
    UseInterceptors,
} from "@nestjs/common";

import { GetUser, ValidateUser } from "@common/jwt/jwt.decorator";
import { AwsService } from "@main/aws/aws.service";
import { FileInterceptor } from "@nestjs/platform-express";
import {
    ApiBearerAuth,
    ApiBody,
    ApiConsumes,
    ApiOperation,
    ApiParam,
    ApiQuery,
} from "@nestjs/swagger";
import { OrderStatus } from "@prisma/client";
import { PrismaService } from "src/lib/prisma/prisma.service";
import { UpdateDeliveryDateDto } from "./dto/order.dto";
import { OrdersService } from "./order.service";

@Controller("orders")
export class OrdersController {
    constructor(
        private readonly ordersService: OrdersService,
        private readonly prisma: PrismaService,
        private awsservice: AwsService,
    ) {}

    // @ApiBearerAuth()
    // @ValidateUser()
    // @Get("tessss")
    // @ApiOperation({ summary: "Create a new order" })
    // async createOrder(@GetUser() user: any, @Body() dto: any) {
    //     return await this.prisma.order.findMany();
    // }

    @ApiBearerAuth()
    @ValidateUser()
    @Get("my-orders")
    @ApiQuery({
        name: "status",
        required: false,
        enum: OrderStatus,
        description:
            "Filter orders by OrderStatus: PENDING, IN_PROGRESS, PROOF_SUBMITTED, CANCELLED, RELEASED",
    })
    async getMyOrders(@GetUser() user: any, @Query("status") status?: OrderStatus) {
        return this.ordersService.getOrdersByBuyer(user.userId, status);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get("my_service_orders")
    async myServiceOrders(@GetUser() user: any) {
        return this.ordersService.myServiceOrder(user.userId);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get("my-earnings")
    @ApiOperation({ summary: "Get seller earnings summary" })
    async myEarnings(@GetUser() user: any) {
        return this.ordersService.getMyEarnings(user.userId);
    }

    // Get buyer all orders

    // @ApiBearerAuth()
    // @ValidateUser()
    // @Get("my-orders")
    // getMyOrders(@GetUser() user: any) {
    //     console.log("ami asol user", user);

    //     return this.ordersService.getOrdersByBuyer(user.userId);
    // }

    // Get single order
    @ApiBearerAuth()
    @ValidateUser()
    @Get(":id")
    getOne(@Param("id") id: string) {
        return this.ordersService.getOrder(id);
    }

    // -------------------- Proof upload -------------------
    @ApiBearerAuth()
    @ValidateUser()
    @Post("ProofUpload")
    @ApiOperation({ summary: "Proof upload" })
    @ApiConsumes("multipart/form-data")
    @ApiQuery({
        name: "orderId",
        required: true,
        type: String,
    })
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                file: {
                    type: "string",
                    format: "binary",
                },
            },
            required: ["file"],
        },
    })
    @UseInterceptors(
        FileInterceptor("file", {
            // fileFilter: (req, file, cb) => {
            //     if (!file.mimetype.startsWith("image/")) {
            //         return cb(new BadRequestException("Only image files are allowed!"), false);
            //     }
            //     cb(null, true);
            // },
        }),
    )
    async UploadProofFile(
        @Query("orderId") orderId: string,
        @UploadedFile() file: Express.Multer.File,
        @GetUser() user: any,
    ) {
        if (!orderId) throw new BadRequestException("orderId is required");

        if (!file) throw new BadRequestException("File is required");

        const uploaded = await this.awsservice.upload(file);

        return await this.ordersService.submitProof(orderId, user, [uploaded.url]);
    }

    //prof view from order id
    // @ApiBearerAuth()
    // @ValidateUser()
    // @Get(":id/proof")
    // @ApiOperation({ summary: "Get proof URLs for an order" })
    // async getProofs(@Param("id") orderId: string) {
    //     const order = await this.prisma.order.findUnique({
    //         where: { id: orderId },
    //         select: { proofUrls: true },
    //     });

    //     if (!order) {
    //         throw new BadRequestException("Order not found");
    //     }

    //     return { proofUrls: order.proofUrls };
    // }

    // ----------------------------- orders status update ------------------------------
    @ApiBearerAuth()
    @ValidateUser()
    @Patch(":id/status")
    @ApiOperation({ summary: "Update order status (seller/admin logic applied)" })
    @ApiQuery({
        name: "status",
        enum: OrderStatus,
        required: true,
        description: "Filter orders by status",
    })
    updateStatus(
        @Param("id") id: string,
        @Query("status") status: OrderStatus,
        @GetUser() user: any,
    ) {
        return this.ordersService.updateStatus(id, status, user);
    }

    // --------------- Delete order (admin OR buyer before payment) ---------------

    @Delete("delete/:orderId")
    @ApiBearerAuth()
    @ValidateUser()
    @ApiOperation({
        summary: "Delete an order (Buyer or Admin can delete)",
        description: `
                ✔ Buyer can delete OWN order  
                ✔ Admin / Super Admin can delete ANY order  
                ❌ Seller or other users cannot delete the order.  
        `,
    })
    @ApiParam({
        name: "orderId",
        description: "ID of the order to delete",
        example: "ord_123456789",
    })
    async deleteOrder(@Param("orderId") orderId: string, @GetUser() user: any) {
        return this.ordersService.deleteOrder(orderId, user);
    }

    @Patch(":id/delivery-date")
    @ApiBearerAuth()
    @ValidateUser()
    @ApiOperation({ summary: "Update order delivery date (Seller/Admin only)" })
    async updateDeliveryDate(
        @Param("id") orderId: string,
        @Body() dto: UpdateDeliveryDateDto,
        @GetUser() user: any,
    ) {
        return this.ordersService.updateDeliveryDate(orderId, user, dto.deliveryDate);
    }

    @Patch(":id/cancel-proof")
    @ApiBearerAuth()
    @ValidateUser()
    @ApiOperation({
        summary: "Update isCancalProofSubmitted and clear proofUrl if true",
        description:
            "If isCancalProofSubmitted is true, proofUrl will be emptied. If false, proofUrl remains unchanged.",
    })
    @ApiQuery({
        name: "isCancalProofSubmitted",
        required: true,
        type: Boolean,
        description: "Set to true to cancel proof (clears proofUrl), false to restore",
    })
    async updateCancelProof(
        @Param("id") orderId: string,
        @Query("isCancalProofSubmitted") isCancalProofSubmitted: string,
    ) {
        const boolValue = isCancalProofSubmitted === "true";
        return this.ordersService.updateCancalProofSubmitted(orderId, boolValue);
    }
}
