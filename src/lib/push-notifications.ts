import { getDb } from "@/lib/mongodb";
import { getAdminAuth } from "@/lib/firebase-admin";

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ userId });
    
    if (!user || !user.fcmToken) {
      console.log(`[Push] User ${userId} has no FCM token. Skipping push.`);
      return false;
    }

    const { getMessaging } = await import("firebase-admin/messaging");

    const message = {
      notification: {
        title,
        body,
      },
      data,
      token: user.fcmToken,
    };

    const response = await getMessaging().send(message);
    console.log(`[Push] Successfully sent message to ${userId}: ${response}`);
    return true;
  } catch (error) {
    console.error(`[Push] Error sending push to ${userId}:`, error);
    return false;
  }
}
