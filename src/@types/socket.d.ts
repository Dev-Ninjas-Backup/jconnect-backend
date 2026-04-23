import { SocketUser } from "@module/(sockets)/@types";

declare module "socket.io" {
    interface Socket {
        user?: SocketUser;
    }
}
