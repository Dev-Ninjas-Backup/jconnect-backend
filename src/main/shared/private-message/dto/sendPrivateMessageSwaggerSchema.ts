export const sendPrivateMessageSwaggerSchema = {
    type: "object",
    properties: {
        content: {
            type: "string",
            example: "Hello, how are you?",
        },
        replyToMessageId: {
            type: "string",
            example: "d501e6a1-8f83-4fba-b2ea-4b3ddc41bfa9",
        },
        file: {
            type: "array",
            items: {
                type: "string",
                format: "binary",
            },
            description: "Upload one or multiple files (max 5)",
        },
    },
    required: ["content"],
};
