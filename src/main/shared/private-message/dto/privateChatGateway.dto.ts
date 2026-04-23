import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsOptional, IsString } from "class-validator";

// export class SendPrivateMessageDto {
//     @IsString()
//     recipientId: string;

//     @IsString()
//     content: string;

//     @IsOptional()
//     @IsArray({ each: true })
//     files: string[];

//     @IsOptional()
//     @IsString()
//     replyToMessageId?: string;
// }

export class SendPrivateMessageDto {
    @ApiProperty({
        type: String,
        example: "7e5c4b66-3a5d-4b8f-b3df-0a1de3159b11",
        description: "Recipient user ID",
    })
    @IsString()
    recipientId: string;

    @ApiProperty({
        type: String,
        example: "7348343543943?",
        description: "SERVICE ID text content",
    })
    @IsString()
    content: string;

    @ApiPropertyOptional({
        type: [String],
        example: ["uploads/chat/file1.jpg", "uploads/chat/file2.pdf"],
        description: "Stored path of uploaded files (auto-filled after upload)",
    })
    @IsOptional()
    @IsArray({ each: true })
    files: string[];

    @ApiProperty({
        type: String,
        example: "d069d51a-5fc6-4252-bf26-3314acd307f5",
        description: "service id of the message being sent",
    })
    @IsOptional()
    @IsString()
    serviceId: string;

    @ApiPropertyOptional({
        type: String,
        example: "a1b2c3d4-5678-90ab-cdef-1234567890ab",
        description: "Optional: Service Request ID related to this message",
    })
    @IsOptional()
    @IsString()
    serviceRequestId?: string;

    @ApiPropertyOptional({
        type: String,
        example: "35fbd767-2160-49b2-90f8-187a19de70ff",
        description: "Optional: ID of the message being replied to",
    })
    @IsOptional()
    @IsString()
    replyToMessageId?: string;
}
