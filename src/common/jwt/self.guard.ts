import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { UserEnum } from "../enum/user.enum";
import { RequestWithUser } from "./jwt.interface";

@Injectable()
export class SelfGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest<RequestWithUser>();
        const user = request.user;
        const paramId = request.params.id;

        if (!user) throw new ForbiddenException("User not found in request");

        const isSuperAdmin = user.roles.includes(UserEnum.SUPER_ADMIN); // ✅ array safe

        if (user.id !== paramId && !isSuperAdmin) {
            throw new ForbiddenException("You can only access your own data");
        }

        return true;
    }
}
