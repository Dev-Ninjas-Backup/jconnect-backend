import { PartialType } from "@nestjs/swagger";
import { CreatePrivateMessageDto } from "./create-private-message.dto";

export class UpdatePrivateMessageDto extends PartialType(CreatePrivateMessageDto) {}
