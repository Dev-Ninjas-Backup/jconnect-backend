import { ValidateSuperAdmin } from "@common/jwt/jwt.decorator";
import { Controller, Get, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { testService } from "./test.service";

@ApiTags("Stripe Admin")
@Controller("stripe")
export class StripeController {
    constructor(private readonly stripeService: testService) {}

    @Get("delete-test-accounts")
    @ApiOperation({
        summary: "Delete all Stripe test connected accounts",
        description:
            "This endpoint deletes ALL Stripe test-mode connected seller accounts. Use only in test environment.",
    })
    @ApiResponse({
        status: 200,
        description: "Successfully deleted all test accounts",
        schema: {
            example: {
                message: "All Stripe test connected accounts deleted successfully.",
                totalAccounts: 5,
            },
        },
    })
    async deleteAllTestAccounts() {
        return this.stripeService.deleteAllStripeTestAccounts();
    }

    @ApiBearerAuth()
    @ValidateSuperAdmin()
    @Get("deleteallOrders")
    async deleteallOrders() {
        return this.stripeService.deleteallOrders();
    }

    @ApiBearerAuth()
    @ValidateSuperAdmin()
    @Get("deleteOrder/:id")
    async deleteOrder(@Query("id") id: string) {
        return this.stripeService.deleteOrder(id);
    }
}
