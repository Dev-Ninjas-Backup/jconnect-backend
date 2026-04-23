import { Global, Module } from "@nestjs/common";
import { FirebaseMessagingService } from "./firebase-messaging.service";
import { FirebaseAdminProvider } from "./firebase.admin.provider";

@Global()
@Module({
    providers: [FirebaseAdminProvider, FirebaseMessagingService],
    exports: [FirebaseAdminProvider, FirebaseMessagingService],
})
export class FirebaseModule {}
