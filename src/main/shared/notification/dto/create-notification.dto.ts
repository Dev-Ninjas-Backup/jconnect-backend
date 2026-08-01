import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class NotificationToggleDto {
    @ApiPropertyOptional({
        description: "Receive email notifications",
    })
    @IsOptional()
    @IsBoolean()
    email?: boolean;

    @ApiPropertyOptional({
        description: "Receive userUpdates notifications",
    })
    @IsOptional()
    @IsBoolean()
    userUpdates?: boolean;

    @ApiPropertyOptional({
        description: "Receive serviceCreate notifications",
    })
    @IsOptional()
    @IsBoolean()
    serviceCreate?: boolean;

    @ApiPropertyOptional({
        description: "Receive review and projects notifications",
    })
    @IsOptional()
    @IsBoolean()
    review?: boolean;

    @ApiPropertyOptional({
        description: "Receive post notifications",
    })
    @IsOptional()
    @IsBoolean()
    post?: boolean;

    @ApiPropertyOptional({
        description: "Receive Service notifications",
    })
    @IsOptional()
    @IsBoolean()
    Service?: boolean;

    @ApiPropertyOptional({
        description: "Receive message notifications",
    })
    @IsOptional()
    @IsBoolean()
    message?: boolean;

    @ApiPropertyOptional({
        description: "Receive inquiry notifications",
    })
    @IsOptional()
    @IsBoolean()
    Inquiry?: boolean;

    @ApiPropertyOptional({
        description: "Receive user registration notifications",
    })
    @IsOptional()
    @IsBoolean()
    userRegistration?: boolean;
}
