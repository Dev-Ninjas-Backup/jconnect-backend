-- Add Message notification type for private chat (was incorrectly stored as Inquiry)
ALTER TYPE "NotificationType" ADD VALUE 'Message';

-- Recover toggles wiped to false by NotificationToggleDto default bug
UPDATE "notification-toggle"
SET
  message = true,
  "Inquiry" = true
WHERE message = false OR "Inquiry" = false;
