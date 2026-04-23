import { Global, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { DeviceService } from "./device.service";

@Global()
@Module({
    imports: [ConfigModule],
    providers: [DeviceService],
    exports: [DeviceService],
})
export class DeviceModule {}
