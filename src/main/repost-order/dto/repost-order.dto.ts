import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProofType, RepostPlatform, RepostTimeframe } from "@prisma/client";
import { IsEnum, IsInt, IsOptional, IsString, Min } from "class-validator";

export class CreateRepostOrderDto {
    @ApiProperty({ example: "listing-uuid" })
    @IsString()
    listingId: string;

    @ApiProperty({ enum: RepostPlatform })
    @IsEnum(RepostPlatform)
    platform: RepostPlatform;

    @ApiProperty({ enum: RepostTimeframe, example: RepostTimeframe.ONE_HOUR })
    @IsEnum(RepostTimeframe)
    timeframe: RepostTimeframe;

    @ApiProperty({ example: 500, description: "Amount in cents" })
    @IsInt()
    @Min(1)
    amount: number;

    @ApiPropertyOptional({ example: "https://instagram.com/p/abc123" })
    @IsOptional()
    @IsString()
    contentUrl?: string;

    @ApiPropertyOptional({ example: "pi_xxx", description: "Stripe PaymentIntent ID" })
    @IsOptional()
    @IsString()
    paymentIntentId?: string;
}

export class SubmitProofDto {
    @ApiProperty({ enum: ProofType })
    @IsEnum(ProofType)
    proofType: ProofType;

    @ApiPropertyOptional({ example: "https://drive.google.com/file/xxx" })
    @IsOptional()
    @IsString()
    proofUrl?: string;
}

export class ReviewActionDto {
    @ApiProperty({ enum: ["ACCEPT", "REJECT", "REDO"], example: "ACCEPT" })
    @IsString()
    action: "ACCEPT" | "REJECT" | "REDO";
}
