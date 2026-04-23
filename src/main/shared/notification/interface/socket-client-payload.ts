export type PayloadForSocketClient = {
    sub: string;
    email: string;
    userUpdates: boolean;
    review: boolean;
    post: boolean;
    message: boolean;
    userRegistration: boolean;
    Service: boolean;
    Inquiry: boolean;
    UploadProof: boolean;
    PaymentReminder: boolean;
    follow: boolean;
};
