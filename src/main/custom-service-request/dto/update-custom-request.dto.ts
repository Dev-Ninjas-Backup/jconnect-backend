import { PartialType } from "@nestjs/mapped-types";
import { CreateCustomRequestDto } from "./create-custom-request.dto";

export class UpdateCustomRequestDto extends PartialType(CreateCustomRequestDto) {}
