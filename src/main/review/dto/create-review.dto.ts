import { ApiProperty } from "@nestjs/swagger"; // 💡 Import this
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from "class-validator";

export class CreateReviewDto {
    @ApiProperty({
        description: "The ID of the User (who has the ARTIST role) receiving the review.",
        example: "09876543-21ba-dcfe-8765-4321fedcba98", // Example UUID
    })
    @IsNotEmpty()
    @IsString()
    artistId: string;

    @ApiProperty({
        description: "The star rating given (must be between 1 and 5).",
        example: 5, // Example value
        default: 5, // Default value shown in Swagger UI (if applicable)
        minimum: 1,
        maximum: 5,
    })
    @IsInt()
    @Min(1)
    @Max(5)
    @IsNotEmpty()
    rating: number; // Star rating (1 to 5)

    @ApiProperty({
        description: "Optional detailed text review/comment.",
        example: "The service was excellent and highly professional!",
        required: false, // Matches IsOptional()
        default: "",
    })
    @IsOptional()
    @IsString()
    reviewText?: string;
}
