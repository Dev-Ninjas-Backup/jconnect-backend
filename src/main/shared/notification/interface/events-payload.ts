import {
    InquiryMeta,
    MessageMeta,
    PostMeta,
    ReviewMeta,
    ServiceMeta,
    UploadProofMeta,
    UserRegistrationMeta,
} from "./events.name";

// Generic Base Event
export interface BaseEvent<TMeta> {
    action: "CREATE" | "UPDATE" | "DELETE";
    meta: TMeta;
}

// Notification Base
export interface Notification {
    type: string;
    title: string;
    message: string;
    createdAt: Date;
    meta: Record<string, any>;
}

// User Registration Event
export interface UserRegistration extends BaseEvent<UserRegistrationMeta> {
    info: {
        email: string;
        id: string;
        name: string;
        role: string;
        recipients: { id: string; email: string }[];
    };
}

//----------------------- Post Event ----------------------
export interface PostEvent extends BaseEvent<PostMeta> {
    info: {
        title: string;
        message: string;
        authorId: string;
        recipients: { id: string; email: string }[];
    };
}
export interface ServiceEvent extends BaseEvent<ServiceMeta> {
    info: {
        serviceName: string;
        description: string;
        authorId: string;
        publishedAt: Date;
        recipients: { id: string; email: string }[];
    };
}

// --------------------- Message Event ----------------------
export interface Message extends BaseEvent<MessageMeta> {
    info: {
        fromUserId: string;
        toUserId: string;
        content: string;
        sendEmail: boolean;
    };
}

//  ---------------------Review Event ----------------------
export interface ReviewEvent extends BaseEvent<ReviewMeta> {
    info: {
        reviewId: string;
        reviewContent: string;
        performedBy: string;
        recipients: { id: string; email: string }[];
    };
}
//  ---------------------Inquiry Event ----------------------
export interface InquiryEvent extends BaseEvent<InquiryMeta> {
    info: {
        inquiryId: string;
        subject: string;
        message: string;
        fromUserId: string;
        recipients: { id: string; email: string }[];
    };
}
//  ---------------------Upload Proof Event ----------------------
export interface UploadProofEvent extends BaseEvent<UploadProofMeta> {
    info: {
        uploadedFileUrl: string;
        uploadedAt: Date;
        uploadedByUserId: string;
        recipients: { id: string; email: string }[];
    };
}
