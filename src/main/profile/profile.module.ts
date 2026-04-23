// src/profile/profile.module.ts
import { Module } from "@nestjs/common";
import { ProfileController } from "./profile.controller";
import { ProfileService } from "./profile.service";
import { SocialProfileController } from "./social-profile.controller";
import { SocialProfileService } from "./social-profile.service";

@Module({
    controllers: [ProfileController, SocialProfileController],
    providers: [ProfileService, SocialProfileService],
})
export class ProfileModule {}
