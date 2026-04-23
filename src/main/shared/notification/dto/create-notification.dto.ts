import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsOptional } from "class-validator";

export class NotificationToggleDto {
    @ApiPropertyOptional({
        description: "Receive email notifications",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    email?: boolean = false;

    @ApiPropertyOptional({
        description: "Receive userUpdates notifications",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    userUpdates?: boolean = false;

    @ApiPropertyOptional({
        description: "Receive serviceCreate notifications",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    serviceCreate?: boolean = false;

    @ApiPropertyOptional({
        description: "Receive review and projects notifications",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    review?: boolean = false;

    @ApiPropertyOptional({
        description: "Receive post notifications",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    post?: boolean = false;

    @ApiPropertyOptional({
        description: "Receive   Service notifications",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    Service?: boolean = false;

    @ApiPropertyOptional({
        description: "Receive message notifications",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    message?: boolean = false;

    @ApiPropertyOptional({
        description: "Receive user registration notifications",
        default: false,
    })
    @IsOptional()
    @IsBoolean()
    userRegistration?: boolean = false;
}
