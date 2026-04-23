import {
    Body,
    Controller,
    Delete,
    forwardRef,
    Get,
    Inject,
    OnModuleInit,
    Param,
    Patch,
    Post,
    Query,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import { GetUser, ValidateAuth, ValidateUser } from "src/common/jwt/jwt.decorator";
import { SendPrivateMessageDto } from "../dto/privateChatGateway.dto";
import { PrivateChatGateway } from "../privateChatGateway/privateChatGateway";
import { PrivateChatService } from "../service/private-message.service";

@ApiTags("Seller/help/artist message")
@Controller("private-chat")
@ValidateAuth()
@ApiBearerAuth()
export class PrivateChatController implements OnModuleInit {
    private gateway: PrivateChatGateway;

    constructor(
        private readonly privateService: PrivateChatService,
        @Inject(forwardRef(() => PrivateChatGateway))
        private readonly injectedGateway: PrivateChatGateway,
    ) {}

    onModuleInit() {
        this.gateway = this.injectedGateway;
    }

    @Get()
    @ApiOperation({ summary: "Get All Private message" })
    async getAllPrivateMessage(@GetUser("userId") userId: string) {
        return await this.privateService.getAllChatsWithLastMessage(userId);
    }
    // ----------------- get conversation message with service id and show all service request data----------------
    @Get(":conversationId")
    @ApiOperation({ summary: "Get messages for a specific private conversation" })
    @ApiQuery({
        name: "serviceRequestsId",
        required: false,
        description: "Optional service request ID to include serviceRequests data",
    })
    async getConversationMessages(
        @Param("conversationId") conversationId: string,
        @GetUser("userId") userId: string,
        @Query("serviceRequestsId") serviceRequestsId?: string,
    ) {
        return await this.privateService.getPrivateConversationWithMessages(
            conversationId,
            userId,
            serviceRequestsId,
        );
    }
    // -----------send message for--------------

    @Post("send-message/:recipientId")
    @ApiOperation({ summary: "Sending Private message" })
    async sendTeamMessage(
        @Param("recipientId") recipientId: string,
        @Body() dto: SendPrivateMessageDto,
        @GetUser("userId") senderId: string,
    ) {
        if (recipientId === senderId) {
            throw new Error("Cannot send message to yourself");
        }

        const conversation = await this.privateService.findOrCreateConversation(
            senderId,
            recipientId,
        );

        const message = await this.privateService.sendPrivateMessage(
            conversation.id,
            senderId,
            dto,
        );

        //-------------- Emit to both sender and recipient to update their chat lists and messages in real-time ----------------
        this.gateway.emitNewMessage(senderId, message);
        this.gateway.emitNewMessage(recipientId, message);

        return { success: true, message };
    }

    @Post("make-private-message-read/:messageId")
    async makePrivateMassageReadTrue(@Param("messageId") messageId: string) {
        return await this.privateService.makePrivateMassageReadTrue(messageId);
    }

    @ApiOperation({ summary: "Delete a private conversation and all its messages" })
    @Delete(":conversationId")
    async deleteConversation(@Param("conversationId") conversationId: string) {
        return await this.privateService.deleteConversation(conversationId);
    }

    @Get("users/chatted-with-me")
    @ApiOperation({ summary: "Get all users who have chatted with me with unread counts" })
    async getAllUsersChatWithMe(@GetUser("userId") userId: string) {
        return await this.privateService.getAllUsersChatWithMe(userId);
    }

    //------------------- Decline or accept a service request----------------
    @Patch(":id/is-declined")
    @ApiOperation({ summary: "Decline or accept a service request" })
    @ApiQuery({ name: "isDeclined", type: Boolean, required: false })
    @ApiQuery({ name: "isAccepted", type: Boolean, required: false })
    async updateIsDeclined(
        @Param("id") id: string,
        @Query("isDeclined") isDeclined?: boolean,
        @Query("isAccepted") isAccepted?: boolean,
        @GetUser("userId") userId?: string,
    ) {
        const updateData: { isDeclined?: boolean; isAccepted?: boolean } = {};

        if (isDeclined !== undefined) {
            updateData.isDeclined = isDeclined;
        }

        if (isAccepted !== undefined) {
            updateData.isAccepted = isAccepted;
        }

        const updatedServiceRequest = await this.privateService.updateIsDeclined(id, updateData);

        this.gateway.emitServiceRequestUpdate(updatedServiceRequest);

        return { success: true, updatedServiceRequest };
    }

    //  ------------- update file URLs for service request----------------
    @ApiBearerAuth()
    @ValidateUser()
    @Patch(":id/uploaded-files")
    @ApiOperation({ summary: "Update uploaded file URLs for service request" })
    async updateUploadedFiles(
        @Param("id") id: string,
        @Body() body: { uploadedFileUrl: string[] },
        @GetUser() user: any,
    ) {
        const updatedServiceRequest = await this.privateService.updateUploadedFiles(
            id,
            body.uploadedFileUrl || [],
            user,
        );

        this.gateway.emitServiceRequestFilesUpdate(updatedServiceRequest);

        return { success: true, updatedServiceRequest };
    }
}
