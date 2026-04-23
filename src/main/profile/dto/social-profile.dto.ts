import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsString, IsUrl } from "class-validator";

export class CreateSocialProfileDto {
    @ApiProperty({ example: "Instagram" })
    @IsString()
    platformName: string;

    @ApiProperty({ example: "https://instagram.com/example" })
    @IsUrl()
    platformLink: string;
}

export class UpdateSocialProfileDto {
    @ApiPropertyOptional({ example: "Instagram" })
    @IsString()
    platformName?: string;

    @ApiPropertyOptional({ example: "https://instagram.com/example" })
    @IsUrl()
    platformLink?: string;
}
