import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";

export class ConfirmSetupIntentDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    clientSecret: string;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    token: string;

    //   @ApiProperty()
    //   @IsString()
    //   @IsNotEmpty()
    //   cardNumber: string;

    //   @ApiProperty()
    //   @IsNumber()
    //   expMonth: number;

    //   @ApiProperty()
    //   @IsNumber()
    //   expYear: number;

    //   @ApiProperty()
    //   @IsString()
    //   @IsNotEmpty()
    //   cvc: string;
}

export class CreateSetupIntentDto {}
