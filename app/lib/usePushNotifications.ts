import { useEffect, useState } from 'react';
import * as Notifications from 'expo-notifications';

// Configure default notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications() {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);

  useEffect(() => {
    // Register for push notifications
    registerForPushNotificationsAsync();
  }, []);

  useEffect(() => {
    // Listen for notifications when app is in foreground
    const subscription = Notifications.addNotificationReceivedListener((notification) => {
      setNotification(notification);
    });

    // Listen for notification taps (app opens from notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        console.log('Notification response:', response);
        // Handle navigation based on notification data
      },
    );

    return () => {
      Notifications.removeNotificationSubscription(subscription);
      Notifications.removeNotificationSubscription(responseSubscription);
    };
  }, []);

  return { expoPushToken, notification };
}

async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.warn('Failed to get push notification permissions');
      return null;
    }

    // Get Expo push token
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('Expo Push Token:', token);
    return token;
  } catch (err) {
    console.warn('Failed to get push token:', err);
    return null;
  }
}

// Send local notification (for testing)
export async function sendLocalNotification(
  title: string,
  body: string,
  delay: number = 2,
) {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
      },
      trigger: { seconds: delay },
    });
  } catch (err) {
    console.warn('Failed to schedule notification:', err);
  }
}

// Send push notification via Supabase (backend integration)
export async function sendPushNotification(
  expoPushToken: string,
  title: string,
  body: string,
  data?: Record<string, any>,
) {
  const message = {
    to: expoPushToken,
    sound: 'default',
    title,
    body,
    data,
  };

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  } catch (err) {
    console.warn('Failed to send push notification:', err);
  }
}
