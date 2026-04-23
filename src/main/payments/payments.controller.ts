import { GetUser, ValidateSuperAdmin, ValidateUser } from "@common/jwt/jwt.decorator";
import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Headers,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    Req,
} from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiBody,
    ApiExcludeEndpoint,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { ConfirmSetupIntentDto } from "./dto/confirm-setup-intent.dto";
import { PaginationDto } from "./dto/pagination.dto";
import { WithdrawDto } from "./dto/withdraw.dto";
import { PaymentService } from "./payments.service";

@ApiTags("Payment")
@Controller("payments")
export class PaymentController {
    constructor(private readonly paymentService: PaymentService) {}

    @ApiBearerAuth()
    @ValidateUser()
    @Post("customerID")
    @ApiOperation({
        summary:
            "if you have'n create customer id / invalid customer id then again create customer id",
    })
    async create_stripe_customerId(@GetUser() user: any) {
        return this.paymentService.createCustomerID(user);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Post("create-setup-intent")
    @ApiOperation({ summary: "get client secret for payment method" })
    async createSetupIntent(@GetUser() user: any) {
        return this.paymentService.createSetupIntent(user);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Post("confirm-setup-intent")
    @ApiOperation({ summary: "Confirm SetupIntent with secrete and card token (payment method)" })
    @ApiBody({ type: ConfirmSetupIntentDto })
    async confirmSetupIntent(@Body() body: ConfirmSetupIntentDto, @GetUser() user: any) {
        return this.paymentService.confirmSetupIntent(body, user);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @ApiQuery({
        name: "payment_method_id",
        type: String,
        required: true,
    })
    @Post("payment_method_attached")
    async payment_method_attached(@GetUser() user: any, @Query() payment_method_id: any) {
        console.log("ami methode id ========", payment_method_id);

        const res = await this.paymentService.payment_method_attached(
            payment_method_id.payment_method_id,
            user,
        );
        return { message: "success", res };
    }

    // ------------- show all payment methods-------------------
    @ApiBearerAuth()
    @ValidateUser()
    @Get("my-paymentsss-methods")
    @ApiOperation({ summary: "Get all payment methods of the user" })
    async getMyPaymentMethods(@GetUser() user: any) {
        return this.paymentService.getMyPaymentMethods(user);
    }

    // ----------------------------
    // Delete Payment Method
    // ----------------------------
    @ApiBearerAuth()
    @ValidateUser()
    @Delete("delete-payment-method")
    @ApiOperation({ summary: "Delete a payment method" })
    @ApiBody({
        description: "Payment method ID to delete",
        schema: {
            type: "object",
            properties: {
                paymentMethodId: { type: "string", example: "cmidkddvy0000vsy0l8xxxxxxx" },
            },
            required: ["paymentMethodId"],
        },
    })
    async DeletePaymentMethode(@Body() body: { paymentMethodId: string }, @GetUser() user: any) {
        return this.paymentService.delete_payment_methode(body.paymentMethodId, user);
    }

    @ApiBearerAuth()
    @ValidateUser()
    @Get("my-withdrawal-history")
    @ApiOperation({ summary: "my withdrawal history" })
    async withdrawalHistory(@GetUser() user: any) {
        return this.paymentService.withdrawalHistory(user);
    }

    // --------------------- all transaction history    ----------------------
    @ApiBearerAuth()
    @ValidateSuperAdmin()
    @Get("all-transaction-history")
    @ApiOperation({ summary: "all transaction history for admin" })
    @ApiQuery({
        name: "page",
        required: false,
        type: Number,
        description: "Page number",
        example: 1,
    })
    @ApiQuery({
        name: "limit",
        required: false,
        type: Number,
        description: "Items per page",
        example: 10,
    })
    @ApiQuery({
        name: "status",
        required: false,
        enum: ["PENDING", "IN_PROGRESS", "PROOF_SUBMITTED", "CANCELLED", "RELEASED"],
        description: "Filter by order status",
    })
    @ApiQuery({
        name: "month",
        required: false,
        enum: [
            "January",
            "February",
            "March",
            "April",
            "May",
            "June",
            "July",
            "August",
            "September",
            "October",
            "November",
            "December",
        ],
        description: "Filter by month name",
        example: "December",
    })
    @ApiQuery({
        name: "sortOrder",
        required: false,
        enum: ["asc", "desc"],
        description: "Sort order (ascending or descending)",
        example: "desc",
    })
    @ApiQuery({
        name: "search",
        required: false,
        type: String,
        description: "Search by order ID",
    })
    async allTransactionHistory(@Query() paginationDto: PaginationDto) {
        return this.paymentService.allTransactionHistory(paginationDto);
    }

    // ----------------- Get single transaction history with details ----------------------
    @ApiBearerAuth()
    @ValidateSuperAdmin()
    @Get("transaction-history/:id")
    @ApiOperation({ summary: "get single transaction history for admin" })
    @ApiParam({ name: "id" })
    async getSingleTransactionHistory(@Param("id") id: string) {
        return this.paymentService.getSingleTransactionHistory(id);
    }

    // ----------------------------
    // Create Checkout Session
    // ----------------------------
    @ApiBearerAuth()
    @ValidateUser()
    @Post("make-payment")
    @ApiOperation({ summary: "buyer make payment with payment-methode with 5% vat charge" })
    @ApiBody({
        schema: {
            type: "object",
            properties: {
                serviceId: { type: "string" },
                frontendUrl: {
                    type: "string",
                    example: "https://shamimrana2006.github.io/shamimrana2006",
                },
            },
            required: ["serviceId", "frontendUrl"],
        },
    })
    async createSession(@GetUser() user, @Body() body: { serviceId: string; frontendUrl: string }) {
        return this.paymentService.createOrderWithPaymentMethod(
            user,
            body.serviceId,
            body.frontendUrl,
        );
    }

    // ----------------------------
    // --------------------- Admin/buyer Approve Payment Release to Seller ----------------------
    // ----------------------------
    @ApiBearerAuth()
    @ValidateUser()
    @Post("approve-payment")
    @ApiOperation({
        summary: "is Admin/Buyer approve payment release to seller",
        description: `
This endpoint is used by Admin/Buyer only.
✔ Finds the order using paymentIntentId  
✔ Captures the charge if still uncaptured  
✔ Calculates platform fee from Settings table  
✔ Transfers seller's portion to their Stripe Connected Account  
✔ Marks order as RELEASED  
`,
    })
    @ApiBody({
        description: "Payment approval payload",
        schema: {
            type: "object",
            properties: {
                orderID: {
                    type: "string",
                    example: "dsafsdf_32432",
                    description: "Order ID associated with the payment to be approved",
                },
            },
            required: ["orderID"],
        },
    })
    async approvePayment(
        @Body()
        body: {
            orderID: string;
        },
        @GetUser() user: any,
    ) {
        return this.paymentService.approvePayment(body.orderID, user);
    }

    // ----------------------------
    // Refund Payment
    // ----------------------------
    // @ApiExcludeEndpoint()
    @ApiBearerAuth()
    @ValidateUser()
    @Post("refund/:orderId")
    @ApiOperation({ summary: "Request a refund for an order" })
    @ApiParam({ name: "orderId", description: "ID of the order to refund" })
    @ApiBearerAuth()
    @ApiResponse({ status: 200, description: "Refund issued successfully" })
    @ApiResponse({ status: 403, description: "User not authorized to request refund" })
    @ApiResponse({ status: 404, description: "Order not found" })
    @ApiResponse({ status: 400, description: "Invalid request / PaymentIntent missing" })
    @HttpCode(HttpStatus.OK)
    async refundPayment(@Param("orderId") orderId: string, @GetUser() user: any) {
        return await this.paymentService.refundPayment(orderId, user);
    }

    @ApiExcludeEndpoint()
    @Post("webhook")
    async stripeWebhook(@Req() req, @Headers("stripe-signature") signature: string) {
        return this.paymentService.handleWebhook(req.body, signature);
    }
    // --------------------- Request withdrawal to seller Stripe account ----------------------
    @ApiBearerAuth()
    @ValidateUser()
    @Post()
    @ApiOperation({ summary: "Request withdrawal to seller Stripe account" })
    @ApiBody({
        description: "Withdraw amount",
        type: WithdrawDto,
    })
    async withdraw(@Body() body: WithdrawDto, @GetUser() user: any) {
        if (!body.amount) {
            throw new BadRequestException("Withdraw amount is required");
        }

        return this.paymentService.transferToSeller(user.userId, body.amount);
    }
    // ----------------- Get earnings and payouts data for individual user ----------------------
    @ApiBearerAuth()
    @ValidateUser()
    @Get("earnings-payouts")
    @ApiOperation({ summary: "Get earnings and payouts data for individual user" })
    @ApiResponse({
        status: 200,
        description:
            "Returns monthly earnings, total earnings, pending clearance, and available to withdraw",
    })
    async getEarningsAndPayouts(@GetUser() user: any) {
        return this.paymentService.getEarningsAndPayouts(user.userId);
    }
}
