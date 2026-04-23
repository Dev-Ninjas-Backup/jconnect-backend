import { Upload } from "@aws-sdk/lib-storage";
import { AuthProvider, Role, ValidationType } from "@constant/enums";

//  -----------------  Event payload interfaces (aligned with NotificationToggle schema) ---------------------
export interface UserRegistrationMeta {
    action: "created";
    info: {
        id: string;
        email: string;
        name: string;
        role: Role;
        phone?: string;
        authProvider?: AuthProvider;
        validationType?: ValidationType;
        createdAt: Date;
        recipients: Array<{
            id: string;
            email: string;
        }>;
    };
    meta?: Record<string, any>;
}

export interface PostMeta {
    postId: string;
    performedBy: string;
    publishedAt: Date;
}

export interface MessageMeta {
    messageId: string;
    fromUserId: string;
    toUserId: string;
    sentAt: Date;
}

export interface ReviewMeta {
    reviewId: string;
    reviewContent: string;
    performedBy: string;
    publishedAt: Date;
}

export interface ServiceMeta {
    serviceName: string;
    description: string;
    authorId: string;
    publishedAt: Date;
}

export interface InquiryMeta {
    inquiryId: string;
    subject: string;
    message: string;
    fromUserId: string;
    submittedAt: Date;
}

export interface ServiceRequestMeta {
    serviceRequestId: string;
    serviceId: string;
    serviceName: string;
    sellerId: string;
    sellerName: string;
    buyerId: string;
    status: "ACCEPTED" | "DECLINED";
    reason?: string;
    actionAt: Date;
}

export interface UploadProofMeta {
    uploadedFileUrl: string;
    uploadedAt: Date;
}

//--------------------EVENT TYPE CONSTANTS --------------------
export const EVENT_TYPES = {
    USERREGISTRATION_CREATE: "user.create",
    USERREGISTRATION_UPDATE: "user.update",
    USERREGISTRATION_DELETE: "user.delete",

    POST_CREATE: "post.create",
    POST_UPDATE: "post.update",
    POST_DELETE: "post.delete",

    MESSAGE_CREATE: "message.create",
    SERVICE_CREATE: "service.create",
    REVIEW_CREATE: "review.create",
    INQUIRY_CREATE: "inquiry.create",
    SERVICE_REQUEST_ACCEPTED: "service_request.accepted",
    SERVICE_REQUEST_DECLINED: "service_request.declined",
    UPLOAD_PROOF: "upload_proof",
} as const;

// ----------------- Type-safe keys for event types -----------------
export type EventType = keyof typeof EVENT_TYPES;

// ------------------ Event payload mapping ------------------
export type EventPayloadMap = {
    [EVENT_TYPES.USERREGISTRATION_CREATE]: UserRegistrationMeta;
    [EVENT_TYPES.USERREGISTRATION_UPDATE]: UserRegistrationMeta;
    [EVENT_TYPES.USERREGISTRATION_DELETE]: UserRegistrationMeta;

    [EVENT_TYPES.POST_CREATE]: PostMeta;
    [EVENT_TYPES.POST_UPDATE]: PostMeta;
    [EVENT_TYPES.POST_DELETE]: PostMeta;

    [EVENT_TYPES.MESSAGE_CREATE]: MessageMeta;

    [EVENT_TYPES.SERVICE_CREATE]: ServiceMeta;
    [EVENT_TYPES.REVIEW_CREATE]: ReviewMeta;
    [EVENT_TYPES.INQUIRY_CREATE]: InquiryMeta;
    [EVENT_TYPES.SERVICE_REQUEST_ACCEPTED]: ServiceRequestMeta;
    [EVENT_TYPES.SERVICE_REQUEST_DECLINED]: ServiceRequestMeta;

    [EVENT_TYPES.UPLOAD_PROOF]: UploadProofMeta;
};
