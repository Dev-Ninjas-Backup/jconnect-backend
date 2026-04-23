import { PartialType } from "@nestjs/swagger";
import { CreateTestRouteDto } from "./create-test-route.dto";

export class UpdateTestRouteDto extends PartialType(CreateTestRouteDto) {}
