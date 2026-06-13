import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProofType, RepostTimeframe } from "@prisma/client";
import { IsEnum, IsOptional, IsString, IsUrl } from "class-validator";

export class CreateRepostOrderDto {
    @ApiProperty({ example: "listing-uuid", description: "Screen 1 — selected repost listing ID" })
    @IsString()
    listingId: string;

    @ApiProperty({
        example: "https://instagram.com/p/abc123",
        description: "Screen 2 — social media URL of the content to repost",
    })
    @IsUrl()
    contentUrl: string;

    @ApiProperty({
        example: "pi_xxx",
        description:
            "Screen 3 — Stripe PaymentIntent ID created client-side after payment. Amount is derived from the listing price.",
    })
    @IsString()
    paymentIntentId: string;

    @ApiProperty({
        enum: RepostTimeframe,
        example: RepostTimeframe.ONE_HOUR,
        description: "Screen 4 — how long the seller has to complete the repost",
    })
    @IsEnum(RepostTimeframe)
    timeframe: RepostTimeframe;
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
