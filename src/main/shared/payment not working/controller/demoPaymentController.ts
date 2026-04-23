// import {
//     BadRequestException,
//     Body,
//     Controller,
//     Get,
//     Param,
//     Post
// } from '@nestjs/common';

// import { GetUser, ValidateAuth, ValidateSuperAdmin } from 'src/common/jwt/jwt.decorator';

// import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
// import { CreatePaymentDto } from '../dto/create-payment.dto';
// import { PaymentService } from '../service/payment.service';

// @Controller('payment')
// export class PaymentController {
//     constructor(private readonly paymentService: PaymentService) { }
//     @ApiBearerAuth()
//     @ValidateAuth()
//     @ApiOperation({ summary: 'Create a payment checkout session' })
//     @Post()
//     async create(
//         @Body() payload: CreatePaymentDto,
//         @GetUser('userId') userId: string,
//     ) {
//         if (!userId) throw new BadRequestException('User not authenticated');
//         return this.paymentService.createCheckoutSession(userId, payload);
//     }

//     @ApiBearerAuth()
//     @ValidateAuth()
//     @ApiOperation({ summary: 'Get my payments' })
//     @Get("/my-payments")
//     async findmyPayment(@GetUser('userId') userId: string) {
//         return this.paymentService.findmyPayment(userId);
//     }

//     // ------------service purchased by id ------------
//     @ApiOperation({ summary: 'Get payment by id' })
//     @ApiBearerAuth()
//     @ValidateAuth()
//     @Get(':id')
//     async myPurchased(@Param('id') id: string) {
//         return this.paymentService.myPurchased(id);
//     }

//     // ------------mySales ------------
//     @ApiOperation({ summary: 'Get my sales' })
//     @ApiBearerAuth()
//     @ValidateAuth()
//     @Get('my-sales')
//     async mySales(@GetUser('userId') userId: string) {
//         return this.paymentService.mySales(userId);
//     }
//     // -------------------  Admin only -------------------
//     @ApiBearerAuth()
//     @ValidateSuperAdmin()
//     @ApiOperation({ summary: 'Get all payments (Admin only)' })
//     @Get('all-payments')
//     async findAll() {
//         return this.paymentService.findAllPayments();
//     }

//     @Get(':id')
//     findOne(@Param('id') id: string) {
//         return this.paymentService.findOne(+id);
//     }

// }
