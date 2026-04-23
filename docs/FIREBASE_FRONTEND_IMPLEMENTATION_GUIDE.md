# Firebase Notification Frontend Implementation Guide

**Version:** 1.0  
**Last Updated:** March 2, 2026  
**Platform:** iOS, Android, Web (React Native / React / Flutter)  
**Backend API:** JConnect Backend with Firebase Cloud Messaging

---

## Table of Contents

1. [Overview](#1-overview)
2. [Prerequisites](#2-prerequisites)
3. [React Native Implementation](#3-react-native-implementation)
4. [React Web Implementation](#4-react-web-implementation)
5. [Flutter Implementation](#5-flutter-implementation)
6. [iOS Native Implementation](#6-ios-native-implementation)
7. [Android Native Implementation](#7-android-native-implementation)
8. [Backend API Integration](#8-backend-api-integration)
9. [Notification Handling Patterns](#9-notification-handling-patterns)
10. [Deep Linking Implementation](#10-deep-linking-implementation)
11. [User Preferences Management](#11-user-preferences-management)
12. [Testing & Debugging](#12-testing--debugging)
13. [Production Checklist](#13-production-checklist)
14. [Common Issues & Solutions](#14-common-issues--solutions)

---

## 1. Overview

### 1.1 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    MOBILE/WEB APP                               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. Initialize Firebase SDK                              │  │
│  │  2. Request Notification Permissions                     │  │
│  │  3. Get FCM Token                                        │  │
│  │  4. Send Token to Backend                                │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ POST /firebase-notifications/update-fcm-token
                         │ Headers: { Authorization: "Bearer <JWT>" }
                         │ Body: { fcmToken: "...", platform: "ios" }
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    JCONNECT BACKEND                             │
│  • Validates JWT                                                │
│  • Stores FCM token in User.fcmToken field                      │
│  • Returns success response                                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         │ User receives notifications
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│              FIREBASE CLOUD MESSAGING                           │
│  • Sends push notifications to registered devices               │
│  • Handles iOS (APNs), Android (FCM), Web (Web Push)           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DEVICE RECEIVES                              │
│  • App in foreground → Custom in-app notification              │
│  • App in background → System notification tray                │
│  • App killed → System notification, tap opens app             │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Frontend Responsibilities

**Your frontend app must handle:**

1. ✅ **Firebase SDK initialization** with your Firebase config
2. ✅ **Permission request** from user to show notifications
3. ✅ **FCM token retrieval** from Firebase SDK
4. ✅ **Token registration** with backend API
5. ✅ **Token refresh handling** when Firebase updates token
6. ✅ **Notification reception** in 3 states (foreground, background, killed)
7. ✅ **Deep linking** to navigate user to relevant screen
8. ✅ **Badge management** (iOS) for unread notification count
9. ✅ **User preferences UI** to enable/disable notification types

### 1.3 Backend Endpoints You'll Use

| Endpoint                                    | Method | Purpose                | Auth Required |
| ------------------------------------------- | ------ | ---------------------- | ------------- |
| `/firebase-notifications/update-fcm-token`  | POST   | Register FCM token     | Yes (JWT)     |
| `/firebase-notifications/subscribe-topic`   | POST   | Subscribe to topic     | Yes (JWT)     |
| `/firebase-notifications/unsubscribe-topic` | POST   | Unsubscribe from topic | Yes (JWT)     |
| `/auth/login`                               | POST   | Login and get JWT      | No            |
| `/auth/register`                            | POST   | Register user          | No            |

---

## 2. Prerequisites

### 2.1 Firebase Project Setup

**Step 1: Create Firebase Project (if not exists)**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select existing project
3. Enter project name: `jconnect` or `jconnect-dev`
4. Enable Google Analytics (optional)
5. Click "Create project"

**Step 2: Register Your App**

**For iOS:**

1. Click iOS icon in Firebase project
2. Enter iOS bundle ID (e.g., `com.jconnect.app`)
3. Download `GoogleService-Info.plist`
4. Add to Xcode project root

**For Android:**

1. Click Android icon in Firebase project
2. Enter Android package name (e.g., `com.jconnect.app`)
3. Download `google-services.json`
4. Place in `android/app/` directory

**For Web:**

1. Click Web icon in Firebase project
2. Register app and get Firebase config object
3. Copy config for use in your web app

### 2.2 Firebase Cloud Messaging Setup

**Enable FCM:**

1. In Firebase Console, go to **Project Settings**
2. Click on **Cloud Messaging** tab
3. Note your **Server Key** (needed for testing)
4. For iOS: Upload APNs authentication key or certificate

**APNs Setup (iOS Only):**

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create APNs Key or Certificate
3. Download and upload to Firebase Console
4. Enable Push Notifications capability in Xcode

### 2.3 Required Dependencies

**React Native:**

```json
{
    "@react-native-firebase/app": "^18.0.0",
    "@react-native-firebase/messaging": "^18.0.0",
    "@notifee/react-native": "^7.8.0",
    "@react-navigation/native": "^6.0.0",
    "axios": "^1.6.0"
}
```

**React Web:**

```json
{
    "firebase": "^10.7.0",
    "axios": "^1.6.0"
}
```

**Flutter:**

```yaml
dependencies:
    firebase_core: ^2.24.0
    firebase_messaging: ^14.7.0
    flutter_local_notifications: ^16.3.0
    http: ^1.1.0
```

---

## 3. React Native Implementation

### 3.1 Installation

```bash
# Install dependencies
npm install @react-native-firebase/app @react-native-firebase/messaging @notifee/react-native

# iOS only - install pods
cd ios && pod install && cd ..
```

### 3.2 Firebase Configuration Files

**iOS - GoogleService-Info.plist:**

Place in `ios/` directory at project root.

**Android - google-services.json:**

Place in `android/app/` directory.

**Android - build.gradle:**

```gradle
// android/build.gradle (project level)
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.0'
  }
}

// android/app/build.gradle
apply plugin: 'com.google.gms.google-services'
```

### 3.3 iOS Configuration

**ios/AppName/AppDelegate.mm:**

```objective-c
#import <Firebase.h>

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];
  // ... rest of code
}
```

**ios/AppName.xcodeproj - Capabilities:**

Enable:

- Push Notifications
- Background Modes → Remote notifications

### 3.4 Permission Request

**src/services/NotificationService.js:**

```javascript
import messaging from "@react-native-firebase/messaging";
import { Platform, Alert } from "react-native";

export class NotificationService {
    // Request permission to show notifications
    static async requestUserPermission() {
        try {
            if (Platform.OS === "ios") {
                const authStatus = await messaging().requestPermission();
                const enabled =
                    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
                    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

                if (!enabled) {
                    Alert.alert(
                        "Notifications Disabled",
                        "Please enable notifications in Settings to receive updates.",
                        [{ text: "OK" }],
                    );
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error("Permission request error:", error);
            return false;
        }
    }

    // Get FCM token
    static async getFCMToken() {
        try {
            const token = await messaging().getToken();
            console.log("FCM Token:", token);
            return token;
        } catch (error) {
            console.error("Get FCM token error:", error);
            return null;
        }
    }
}
```

### 3.5 Token Registration with Backend

**src/services/ApiService.js:**

```javascript
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE_URL = "https://api.jconnect.com"; // Your backend URL

export class ApiService {
    // Update FCM token on backend
    static async updateFCMToken(fcmToken) {
        try {
            // Get JWT token from storage
            const jwtToken = await AsyncStorage.getItem("authToken");

            if (!jwtToken) {
                console.warn("No auth token found, skipping FCM token update");
                return false;
            }

            const platform = Platform.OS; // 'ios' or 'android'

            const response = await axios.post(
                `${API_BASE_URL}/firebase-notifications/update-fcm-token`,
                {
                    fcmToken: fcmToken,
                    platform: platform,
                },
                {
                    headers: {
                        Authorization: `Bearer ${jwtToken}`,
                        "Content-Type": "application/json",
                    },
                },
            );

            console.log("FCM token registered:", response.data);
            return true;
        } catch (error) {
            console.error("Update FCM token error:", error.response?.data || error.message);
            return false;
        }
    }
}
```

### 3.6 Complete Setup Flow

**App.js or index.js:**

```javascript
import React, { useEffect } from 'react';
import messaging from '@react-native-firebase/messaging';
import notifee from '@notifee/react-native';
import { NotificationService } from './services/NotificationService';
import { ApiService } from './services/ApiService';

function App() {

  useEffect(() => {
    setupNotifications();
    setupNotificationHandlers();
  }, []);

  const setupNotifications = async () => {
    // 1. Request permission
    const hasPermission = await NotificationService.requestUserPermission();

    if (!hasPermission) {
      console.log('Notification permission denied');
      return;
    }

    // 2. Get FCM token
    const fcmToken = await NotificationService.getFCMToken();

    if (fcmToken) {
      // 3. Register token with backend
      await ApiService.updateFCMToken(fcmToken);

      // 4. Save token locally for comparison
      await AsyncStorage.setItem('fcmToken', fcmToken);
    }

    // 5. Listen for token refresh
    messaging().onTokenRefresh(async (newToken) => {
      console.log('FCM Token refreshed:', newToken);
      await ApiService.updateFCMToken(newToken);
      await AsyncStorage.setItem('fcmToken', newToken);
    });
  };

  const setupNotificationHandlers = () => {

    // FOREGROUND: App is open and in focus
    messaging().onMessage(async (remoteMessage) => {
      console.log('Foreground notification:', remoteMessage);

      // Display custom in-app notification using Notifee
      await notifee.displayNotification({
        title: remoteMessage.notification?.title || 'New Notification',
        body: remoteMessage.notification?.body || '',
        data: remoteMessage.data,
        android: {
          channelId: 'default',
          smallIcon: 'ic_launcher',
          pressAction: {
            id: 'default',
          },
        },
        ios: {
          sound: 'default',
          foregroundPresentationOptions: {
            alert: true,
            badge: true,
            sound: true,
          },
        },
      });
    });

    // BACKGROUND: App is in background but running
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('Background notification:', remoteMessage);
      // No need to display - system handles it
    });

    // USER TAPS NOTIFICATION (background or killed state)
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('Notification opened app from background:', remoteMessage);
      handleNotificationNavigation(remoteMessage);
    });

    // APP OPENED FROM KILLED STATE BY NOTIFICATION
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('App opened from killed state by notification:', remoteMessage);
          handleNotificationNavigation(remoteMessage);
        }
      });

    // NOTIFEE NOTIFICATION TAPPED (for foreground notifications)
    notifee.onForegroundEvent(({ type, detail }) => {
      if (type === notifee.EventType.PRESS) {
        console.log('Foreground notification tapped:', detail.notification);
        handleNotificationNavigation(detail.notification);
      }
    });
  };

  const handleNotificationNavigation = (notification) => {
    const data = notification.data;

    if (!data) return;

    // Navigate based on notification type
    switch (data.type) {
      case 'NEW_MESSAGE':
        navigation.navigate('Chat', { conversationId: data.conversationId });
        break;
      case 'SERVICE_REQUEST':
        navigation.navigate('ServiceRequest', { requestId: data.entityId });
        break;
      case 'ORDER_UPDATE':
        navigation.navigate('OrderDetails', { orderId: data.entityId });
        break;
      case 'NEW_FOLLOWER':
        navigation.navigate('Profile', { userId: data.entityId });
        break;
      default:
        navigation.navigate('Notifications');
    }
  };

  return (
    // Your app components
  );
}

export default App;
```

### 3.7 Android Notification Channel Setup

**Create notification channel for Android 8+:**

```javascript
// src/services/NotificationService.js
import notifee from "@notifee/react-native";

export class NotificationService {
    static async createNotificationChannels() {
        // Default channel
        await notifee.createChannel({
            id: "default",
            name: "Default Notifications",
            sound: "default",
            importance: notifee.AndroidImportance.HIGH,
        });

        // Messages channel
        await notifee.createChannel({
            id: "messages",
            name: "Messages",
            sound: "message_sound",
            importance: notifee.AndroidImportance.HIGH,
        });

        // Orders channel
        await notifee.createChannel({
            id: "orders",
            name: "Order Updates",
            sound: "default",
            importance: notifee.AndroidImportance.DEFAULT,
        });
    }
}

// Call in App.js useEffect
NotificationService.createNotificationChannels();
```

### 3.8 Badge Count Management (iOS)

```javascript
import notifee from "@notifee/react-native";

// Set badge count
const setBadgeCount = async (count) => {
    await notifee.setBadgeCount(count);
};

// Increment badge
const incrementBadge = async () => {
    const currentBadge = await notifee.getBadgeCount();
    await notifee.setBadgeCount(currentBadge + 1);
};

// Clear badge when app opened or notifications viewed
const clearBadge = async () => {
    await notifee.setBadgeCount(0);
};
```

---

## 4. React Web Implementation

### 4.1 Installation

```bash
npm install firebase axios
```

### 4.2 Firebase Configuration

**src/config/firebase.js:**

```javascript
import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

// Your Firebase config from Firebase Console
const firebaseConfig = {
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "jconnect.firebaseapp.com",
    projectId: "jconnect",
    storageBucket: "jconnect.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:xxxxxxxxxxxxx",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = getMessaging(app);

export { messaging, getToken, onMessage };
```

### 4.3 Service Worker Setup

**public/firebase-messaging-sw.js:**

```javascript
// Import Firebase scripts
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js");

// Initialize Firebase in service worker
firebase.initializeApp({
    apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXX",
    authDomain: "jconnect.firebaseapp.com",
    projectId: "jconnect",
    storageBucket: "jconnect.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:xxxxxxxxxxxxx",
});

const messaging = firebase.messaging();

// Handle background notifications
messaging.onBackgroundMessage((payload) => {
    console.log("Background notification received:", payload);

    const notificationTitle = payload.notification?.title || "New Notification";
    const notificationOptions = {
        body: payload.notification?.body || "",
        icon: "/logo192.png",
        badge: "/badge.png",
        data: payload.data,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
    console.log("Notification clicked:", event);
    event.notification.close();

    const data = event.notification.data;

    // Open app and navigate to relevant page
    event.waitUntil(clients.openWindow("/"));
});
```

### 4.4 Notification Service

**src/services/NotificationService.js:**

```javascript
import { messaging, getToken, onMessage } from "../config/firebase";
import axios from "axios";

const API_BASE_URL = "https://api.jconnect.com";
const VAPID_KEY = "YOUR_VAPID_KEY_FROM_FIREBASE_CONSOLE"; // Get from Firebase Console → Project Settings → Cloud Messaging → Web Push certificates

export class NotificationService {
    // Request permission and get FCM token
    static async requestPermission() {
        try {
            const permission = await Notification.requestPermission();

            if (permission === "granted") {
                console.log("Notification permission granted");

                // Get FCM token
                const token = await getToken(messaging, { vapidKey: VAPID_KEY });

                if (token) {
                    console.log("FCM Token:", token);
                    await this.updateFCMToken(token);
                    localStorage.setItem("fcmToken", token);
                    return token;
                }
            } else {
                console.log("Notification permission denied");
                return null;
            }
        } catch (error) {
            console.error("Error getting notification permission:", error);
            return null;
        }
    }

    // Send token to backend
    static async updateFCMToken(fcmToken) {
        try {
            const authToken = localStorage.getItem("authToken");

            if (!authToken) {
                console.warn("No auth token found");
                return false;
            }

            const response = await axios.post(
                `${API_BASE_URL}/firebase-notifications/update-fcm-token`,
                {
                    fcmToken: fcmToken,
                    platform: "web",
                },
                {
                    headers: {
                        Authorization: `Bearer ${authToken}`,
                        "Content-Type": "application/json",
                    },
                },
            );

            console.log("FCM token registered:", response.data);
            return true;
        } catch (error) {
            console.error("Update FCM token error:", error.response?.data || error.message);
            return false;
        }
    }

    // Listen for foreground messages
    static setupForegroundListener(callback) {
        onMessage(messaging, (payload) => {
            console.log("Foreground message received:", payload);

            // Show custom in-app notification or use browser notification
            if (Notification.permission === "granted") {
                new Notification(payload.notification?.title || "New Notification", {
                    body: payload.notification?.body || "",
                    icon: "/logo192.png",
                    data: payload.data,
                });
            }

            // Call callback for custom handling
            if (callback) {
                callback(payload);
            }
        });
    }
}
```

### 4.5 React Component Integration

**App.js or App.tsx:**

```javascript
import React, { useEffect, useState } from "react";
import { NotificationService } from "./services/NotificationService";
import { useNavigate } from "react-router-dom";

function App() {
    const navigate = useNavigate();
    const [notificationPermission, setNotificationPermission] = useState(Notification.permission);

    useEffect(() => {
        // Setup notifications after user login
        const authToken = localStorage.getItem("authToken");

        if (authToken) {
            setupNotifications();
        }
    }, []);

    const setupNotifications = async () => {
        // Request permission and get token
        await NotificationService.requestPermission();

        // Listen for foreground notifications
        NotificationService.setupForegroundListener((payload) => {
            handleNotificationReceived(payload);
        });
    };

    const handleNotificationReceived = (payload) => {
        const data = payload.data;

        // You can show a custom toast or update UI
        console.log("Notification received:", data);

        // Update notification badge or counter
        updateNotificationCount();
    };

    const handleNotificationClick = (data) => {
        // Navigate based on notification type
        switch (data.type) {
            case "NEW_MESSAGE":
                navigate(`/chat/${data.conversationId}`);
                break;
            case "SERVICE_REQUEST":
                navigate(`/service-requests/${data.entityId}`);
                break;
            case "ORDER_UPDATE":
                navigate(`/orders/${data.entityId}`);
                break;
            default:
                navigate("/notifications");
        }
    };

    const requestNotificationPermission = async () => {
        const token = await NotificationService.requestPermission();
        if (token) {
            setNotificationPermission("granted");
        }
    };

    return (
        <div className="App">
            {notificationPermission === "default" && (
                <div className="notification-banner">
                    <p>Enable notifications to stay updated</p>
                    <button onClick={requestNotificationPermission}>Enable Notifications</button>
                </div>
            )}

            {/* Your app components */}
        </div>
    );
}

export default App;
```

---

## 5. Flutter Implementation

### 5.1 Installation

**pubspec.yaml:**

```yaml
dependencies:
    flutter:
        sdk: flutter
    firebase_core: ^2.24.0
    firebase_messaging: ^14.7.0
    flutter_local_notifications: ^16.3.0
    http: ^1.1.0
    shared_preferences: ^2.2.0
```

```bash
flutter pub get
```

### 5.2 Firebase Configuration

**Android - google-services.json:**

Place in `android/app/` directory.

**iOS - GoogleService-Info.plist:**

Place in `ios/Runner/` directory.

**Android - AndroidManifest.xml:**

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

  <application>
    <!-- ... -->
  </application>
</manifest>
```

### 5.3 Main.dart Setup

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Background message: ${message.messageId}');
}

final FlutterLocalNotificationsPlugin flutterLocalNotificationsPlugin =
    FlutterLocalNotificationsPlugin();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp();

  // Set background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  // Initialize local notifications
  await initializeLocalNotifications();

  runApp(MyApp());
}

Future<void> initializeLocalNotifications() async {
  const AndroidInitializationSettings initializationSettingsAndroid =
      AndroidInitializationSettings('@mipmap/ic_launcher');

  const DarwinInitializationSettings initializationSettingsIOS =
      DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );

  const InitializationSettings initializationSettings = InitializationSettings(
    android: initializationSettingsAndroid,
    iOS: initializationSettingsIOS,
  );

  await flutterLocalNotificationsPlugin.initialize(
    initializationSettings,
    onDidReceiveNotificationResponse: (NotificationResponse response) {
      // Handle notification tap
      handleNotificationTap(response.payload);
    },
  );

  // Create Android notification channel
  const AndroidNotificationChannel channel = AndroidNotificationChannel(
    'high_importance_channel',
    'High Importance Notifications',
    description: 'This channel is used for important notifications.',
    importance: Importance.high,
  );

  await flutterLocalNotificationsPlugin
      .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin>()
      ?.createNotificationChannel(channel);
}

void handleNotificationTap(String? payload) {
  if (payload != null) {
    // Parse payload and navigate
    print('Notification tapped: $payload');
  }
}
```

### 5.4 Notification Service

**lib/services/notification_service.dart:**

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class NotificationService {
  static final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  static const String apiBaseUrl = 'https://api.jconnect.com';

  // Request notification permission
  static Future<bool> requestPermission() async {
    NotificationSettings settings = await _firebaseMessaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('User granted notification permission');
      return true;
    } else {
      print('User denied notification permission');
      return false;
    }
  }

  // Get FCM token
  static Future<String?> getFCMToken() async {
    try {
      String? token = await _firebaseMessaging.getToken();
      print('FCM Token: $token');
      return token;
    } catch (e) {
      print('Error getting FCM token: $e');
      return null;
    }
  }

  // Send token to backend
  static Future<bool> updateFCMToken(String fcmToken) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final authToken = prefs.getString('authToken');

      if (authToken == null) {
        print('No auth token found');
        return false;
      }

      final response = await http.post(
        Uri.parse('$apiBaseUrl/firebase-notifications/update-fcm-token'),
        headers: {
          'Authorization': 'Bearer $authToken',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'fcmToken': fcmToken,
          'platform': Platform.isIOS ? 'ios' : 'android',
        }),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        print('FCM token registered successfully');
        return true;
      } else {
        print('Failed to register FCM token: ${response.body}');
        return false;
      }
    } catch (e) {
      print('Error updating FCM token: $e');
      return false;
    }
  }

  // Setup notification listeners
  static void setupNotificationListeners(Function(RemoteMessage) onMessageReceived) {
    // Foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('Foreground message: ${message.messageId}');

      // Show local notification
      if (message.notification != null) {
        showLocalNotification(message);
      }

      onMessageReceived(message);
    });

    // Notification opened app from background
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      print('Notification opened app: ${message.messageId}');
      handleNotificationNavigation(message);
    });

    // Check if app opened from terminated state
    _firebaseMessaging.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        print('App opened from terminated state: ${message.messageId}');
        handleNotificationNavigation(message);
      }
    });

    // Listen for token refresh
    _firebaseMessaging.onTokenRefresh.listen((String newToken) {
      print('FCM token refreshed: $newToken');
      updateFCMToken(newToken);
    });
  }

  // Show local notification (for foreground)
  static Future<void> showLocalNotification(RemoteMessage message) async {
    const AndroidNotificationDetails androidDetails = AndroidNotificationDetails(
      'high_importance_channel',
      'High Importance Notifications',
      channelDescription: 'This channel is used for important notifications.',
      importance: Importance.high,
      priority: Priority.high,
    );

    const DarwinNotificationDetails iOSDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const NotificationDetails notificationDetails = NotificationDetails(
      android: androidDetails,
      iOS: iOSDetails,
    );

    await _localNotifications.show(
      message.hashCode,
      message.notification?.title ?? 'New Notification',
      message.notification?.body ?? '',
      notificationDetails,
      payload: jsonEncode(message.data),
    );
  }

  // Handle notification navigation
  static void handleNotificationNavigation(RemoteMessage message) {
    final data = message.data;
    final type = data['type'];

    // Use your navigation logic
    switch (type) {
      case 'NEW_MESSAGE':
        // Navigate to chat screen
        break;
      case 'SERVICE_REQUEST':
        // Navigate to service request
        break;
      case 'ORDER_UPDATE':
        // Navigate to order details
        break;
      default:
        // Navigate to notifications list
        break;
    }
  }

  // Initialize complete setup
  static Future<void> initialize() async {
    final hasPermission = await requestPermission();

    if (hasPermission) {
      final token = await getFCMToken();
      if (token != null) {
        await updateFCMToken(token);
      }
    }

    setupNotificationListeners((message) {
      // Handle received notification
      print('Notification received: ${message.data}');
    });
  }
}
```

### 5.5 Usage in Flutter App

**lib/main.dart:**

```dart
class MyApp extends StatefulWidget {
  @override
  _MyAppState createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {

  @override
  void initState() {
    super.initState();
    _initializeNotifications();
  }

  Future<void> _initializeNotifications() async {
    // Check if user is logged in
    final prefs = await SharedPreferences.getInstance();
    final authToken = prefs.getString('authToken');

    if (authToken != null) {
      await NotificationService.initialize();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'JConnect',
      home: HomeScreen(),
    );
  }
}
```

---

## 6. iOS Native Implementation

### 6.1 CocoaPods Setup

**Podfile:**

```ruby
platform :ios, '13.0'

target 'JConnect' do
  use_frameworks!

  # Firebase
  pod 'Firebase/Messaging'
  pod 'Firebase/Core'
end
```

```bash
cd ios
pod install
```

### 6.2 AppDelegate Configuration

**AppDelegate.swift:**

```swift
import UIKit
import Firebase
import UserNotifications

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate, UNUserNotificationCenterDelegate, MessagingDelegate {

  func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {

    // Initialize Firebase
    FirebaseApp.configure()

    // Set messaging delegate
    Messaging.messaging().delegate = self

    // Request notification permission
    UNUserNotificationCenter.current().delegate = self
    let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
    UNUserNotificationCenter.current().requestAuthorization(options: authOptions) { granted, error in
      print("Notification permission granted: \(granted)")
    }

    application.registerForRemoteNotifications()

    return true
  }

  // FCM Token received
  func messaging(_ messaging: Messaging, didReceiveRegistrationToken fcmToken: String?) {
    print("FCM Token: \(fcmToken ?? "")")

    if let token = fcmToken {
      // Send to backend
      sendTokenToBackend(token: token)
    }
  }

  // Send token to backend
  func sendTokenToBackend(token: String) {
    guard let authToken = UserDefaults.standard.string(forKey: "authToken") else {
      print("No auth token found")
      return
    }

    let url = URL(string: "https://api.jconnect.com/firebase-notifications/update-fcm-token")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("Bearer \(authToken)", forHTTPHeaderField: "Authorization")
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")

    let body: [String: Any] = [
      "fcmToken": token,
      "platform": "ios"
    ]

    request.httpBody = try? JSONSerialization.data(withJSONObject: body)

    URLSession.shared.dataTask(with: request) { data, response, error in
      if let error = error {
        print("Error sending token: \(error)")
        return
      }
      print("Token sent successfully")
    }.resume()
  }

  // Handle notification when app in foreground
  func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    completionHandler([.banner, .sound, .badge])
  }

  // Handle notification tap
  func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completionHandler: @escaping () -> Void) {
    let userInfo = response.notification.request.content.userInfo
    handleNotificationNavigation(userInfo: userInfo)
    completionHandler()
  }

  func handleNotificationNavigation(userInfo: [AnyHashable: Any]) {
    guard let type = userInfo["type"] as? String else { return }

    switch type {
    case "NEW_MESSAGE":
      // Navigate to chat
      break
    case "SERVICE_REQUEST":
      // Navigate to service request
      break
    default:
      break
    }
  }
}
```

### 6.3 Xcode Capabilities

1. Open Xcode project
2. Select target → Signing & Capabilities
3. Add capabilities:
    - Push Notifications
    - Background Modes → Remote notifications

---

## 7. Android Native Implementation

### 7.1 Gradle Setup

**build.gradle (project level):**

```gradle
buildscript {
  dependencies {
    classpath 'com.google.gms:google-services:4.4.0'
  }
}
```

**build.gradle (app level):**

```gradle
dependencies {
  implementation platform('com.google.firebase:firebase-bom:32.7.0')
  implementation 'com.google.firebase:firebase-messaging'
  implementation 'com.google.firebase:firebase-analytics'
}

apply plugin: 'com.google.gms.google-services'
```

### 7.2 AndroidManifest.xml

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
  <uses-permission android:name="android.permission.INTERNET"/>
  <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

  <application>
    <!-- Firebase Messaging Service -->
    <service
      android:name=".MyFirebaseMessagingService"
      android:exported="false">
      <intent-filter>
        <action android:name="com.google.firebase.MESSAGING_EVENT"/>
      </intent-filter>
    </service>

    <!-- Default notification channel -->
    <meta-data
      android:name="com.google.firebase.messaging.default_notification_channel_id"
      android:value="default_channel"/>
  </application>
</manifest>
```

### 7.3 Firebase Messaging Service

**MyFirebaseMessagingService.kt:**

```kotlin
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import androidx.core.app.NotificationCompat

class MyFirebaseMessagingService : FirebaseMessagingService() {

  override fun onNewToken(token: String) {
    super.onNewToken(token)
    Log.d("FCM", "New token: $token")

    // Send token to backend
    sendTokenToBackend(token)
  }

  override fun onMessageReceived(message: RemoteMessage) {
    super.onMessageReceived(message)

    Log.d("FCM", "Message received: ${message.messageId}")

    // Show notification
    message.notification?.let {
      showNotification(it.title, it.body, message.data)
    }
  }

  private fun showNotification(title: String?, body: String?, data: Map<String, String>) {
    val channelId = "default_channel"
    val notificationManager = getSystemService(NOTIFICATION_SERVICE) as NotificationManager

    // Create notification channel for Android O+
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      val channel = NotificationChannel(
        channelId,
        "Default Notifications",
        NotificationManager.IMPORTANCE_HIGH
      )
      notificationManager.createNotificationChannel(channel)
    }

    // Create intent for notification tap
    val intent = Intent(this, MainActivity::class.java).apply {
      putExtra("data", data.toString())
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
    }

    val pendingIntent = PendingIntent.getActivity(
      this, 0, intent, PendingIntent.FLAG_IMMUTABLE
    )

    // Build notification
    val notification = NotificationCompat.Builder(this, channelId)
      .setContentTitle(title ?: "New Notification")
      .setContentText(body ?: "")
      .setSmallIcon(R.drawable.ic_notification)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .build()

    notificationManager.notify(System.currentTimeMillis().toInt(), notification)
  }

  private fun sendTokenToBackend(token: String) {
    // Use your preferred HTTP client (Retrofit, OkHttp, etc.)
    // Send POST request to backend with token
  }
}
```

---

## 8. Backend API Integration

### 8.1 API Authentication

**Getting JWT Token:**

```javascript
// Login to get JWT
const loginResponse = await axios.post("https://api.jconnect.com/auth/login", {
    email: "user@example.com",
    password: "password123",
});

const jwtToken = loginResponse.data.token;

// Store token
localStorage.setItem("authToken", jwtToken); // Web
// or
await AsyncStorage.setItem("authToken", jwtToken); // React Native
```

### 8.2 Update FCM Token Endpoint

**Request:**

```http
POST /firebase-notifications/update-fcm-token
Content-Type: application/json
Authorization: Bearer <JWT_TOKEN>

{
  "fcmToken": "dG8_example_FCM_token_string_...",
  "platform": "ios"
}
```

**Response (Success):**

```json
{
    "success": true,
    "message": "FCM token updated successfully"
}
```

**Response (Error):**

```json
{
    "success": false,
    "message": "Invalid token format",
    "statusCode": 400
}
```

### 8.3 Subscribe to Topic

**Use Case:** Subscribe user to receive broadcast announcements

```javascript
const subscribeToTopic = async (topic) => {
    try {
        const authToken = localStorage.getItem("authToken");

        const response = await axios.post(
            "https://api.jconnect.com/firebase-notifications/subscribe-topic",
            { topic: topic }, // e.g., "all_users", "announcements"
            {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
            },
        );

        console.log("Subscribed to topic:", response.data);
    } catch (error) {
        console.error("Subscribe error:", error);
    }
};

// Call after login
await subscribeToTopic("all_users");
```

### 8.4 Unsubscribe from Topic

```javascript
const unsubscribeFromTopic = async (topic) => {
    try {
        const authToken = localStorage.getItem("authToken");

        const response = await axios.post(
            "https://api.jconnect.com/firebase-notifications/unsubscribe-topic",
            { topic: topic },
            {
                headers: {
                    Authorization: `Bearer ${authToken}`,
                    "Content-Type": "application/json",
                },
            },
        );

        console.log("Unsubscribed from topic:", response.data);
    } catch (error) {
        console.error("Unsubscribe error:", error);
    }
};
```

### 8.5 Error Handling

**Common Errors:**

| Status Code | Error        | Solution                          |
| ----------- | ------------ | --------------------------------- |
| 401         | Unauthorized | JWT expired or invalid - re-login |
| 400         | Bad Request  | Invalid fcmToken format           |
| 404         | Not Found    | Endpoint URL incorrect            |
| 500         | Server Error | Backend issue - retry later       |

**Retry Strategy:**

```javascript
const updateFCMTokenWithRetry = async (fcmToken, retries = 3) => {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await ApiService.updateFCMToken(fcmToken);
            if (result) return true;
        } catch (error) {
            if (i === retries - 1) throw error;
            await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
    }
    return false;
};
```

---

## 9. Notification Handling Patterns

### 9.1 App State Handling

**Three App States:**

1. **Foreground:** App is open and in focus
2. **Background:** App is running but not in focus
3. **Killed/Terminated:** App is completely closed

**Handling Matrix:**

| State      | Platform | Behavior                           | Handler                  |
| ---------- | -------- | ---------------------------------- | ------------------------ |
| Foreground | All      | Custom in-app notification         | `onMessage`              |
| Background | All      | System notification tray           | `onBackgroundMessage`    |
| Killed     | All      | System notification, tap opens app | `getInitialNotification` |

### 9.2 Notification Data Structure

**Backend sends this payload:**

```json
{
    "notification": {
        "title": "New Message",
        "body": "John sent you a message"
    },
    "data": {
        "type": "NEW_MESSAGE",
        "senderId": "user123",
        "conversationId": "conv456",
        "timestamp": "2026-03-02T10:30:00Z",
        "action": "OPEN_CHAT"
    }
}
```

**Frontend receives:**

- `notification`: Visual content for system tray
- `data`: Custom data for app logic

### 9.3 Notification Type Mapping

**Backend Notification Types:**

```typescript
enum NotificationType {
    NEW_MESSAGE = "NEW_MESSAGE",
    NEW_FOLLOWER = "NEW_FOLLOWER",
    NEW_LIKE = "NEW_LIKE",
    NEW_COMMENT = "NEW_COMMENT",
    SERVICE_REQUEST = "SERVICE_REQUEST",
    ORDER_UPDATE = "ORDER_UPDATE",
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED",
    REVIEW_RECEIVED = "REVIEW_RECEIVED",
    ANNOUNCEMENT = "ANNOUNCEMENT",
    CUSTOM = "CUSTOM",
}
```

**Frontend Navigation Handler:**

```javascript
const handleNotificationNavigation = (data) => {
    switch (data.type) {
        case "NEW_MESSAGE":
            navigation.navigate("Chat", {
                conversationId: data.conversationId,
                userId: data.senderId,
            });
            break;

        case "SERVICE_REQUEST":
            navigation.navigate("ServiceRequest", {
                requestId: data.entityId,
            });
            break;

        case "ORDER_UPDATE":
            navigation.navigate("OrderDetails", {
                orderId: data.entityId,
            });
            break;

        case "NEW_FOLLOWER":
            navigation.navigate("Profile", {
                userId: data.entityId,
            });
            break;

        case "PAYMENT_RECEIVED":
            navigation.navigate("Payments", {
                paymentId: data.entityId,
            });
            break;

        case "REVIEW_RECEIVED":
            navigation.navigate("Reviews", {
                reviewId: data.entityId,
            });
            break;

        case "ANNOUNCEMENT":
            navigation.navigate("Announcements", {
                announcementId: data.entityId,
            });
            break;

        default:
            navigation.navigate("Notifications");
    }
};
```

### 9.4 Silent Notifications

**Use Case:** Update data in background without showing notification

**Backend sends data-only payload:**

```json
{
    "data": {
        "type": "SILENT_SYNC",
        "action": "refresh_data",
        "timestamp": "2026-03-02T10:30:00Z"
    }
}
```

**Frontend handles silently:**

```javascript
messaging().onMessage(async (remoteMessage) => {
    const data = remoteMessage.data;

    if (data.type === "SILENT_SYNC") {
        // Refresh data without showing notification
        await refreshAppData();
        return; // Don't show notification
    }

    // Show notification for other types
    showNotification(remoteMessage);
});
```

---

## 10. Deep Linking Implementation

### 10.1 React Native Deep Links

**Install react-native-deep-linking or use React Navigation:**

```bash
npm install @react-navigation/native @react-navigation/native-stack
```

**App.js navigation setup:**

```javascript
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Linking } from "react-native";

const Stack = createNativeStackNavigator();

function App() {
    const navigationRef = useRef();

    // Handle deep links from notifications
    useEffect(() => {
        const handleDeepLink = (url) => {
            // Parse URL and navigate
            // e.g., jconnect://chat/conv123
            const route = parseDeepLink(url);
            if (route && navigationRef.current) {
                navigationRef.current.navigate(route.screen, route.params);
            }
        };

        // Listen for deep links
        Linking.addEventListener("url", ({ url }) => handleDeepLink(url));

        // Check if app opened via deep link
        Linking.getInitialURL().then((url) => {
            if (url) handleDeepLink(url);
        });
    }, []);

    return (
        <NavigationContainer ref={navigationRef}>
            <Stack.Navigator>
                <Stack.Screen name="Home" component={HomeScreen} />
                <Stack.Screen name="Chat" component={ChatScreen} />
                <Stack.Screen name="Profile" component={ProfileScreen} />
                {/* Other screens */}
            </Stack.Navigator>
        </NavigationContainer>
    );
}
```

### 10.2 iOS Universal Links

**ios/AppName/Info.plist:**

```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array>
      <string>jconnect</string>
    </array>
  </dict>
</array>
```

### 10.3 Android Deep Links

**android/app/src/main/AndroidManifest.xml:**

```xml
<activity android:name=".MainActivity">
  <intent-filter>
    <action android:name="android.intent.action.VIEW"/>
    <category android:name="android.intent.category.DEFAULT"/>
    <category android:name="android.intent.category.BROWSABLE"/>
    <data android:scheme="jconnect"/>
  </intent-filter>
</activity>
```

### 10.4 Web URL Navigation

```javascript
// Web deep link handling
useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notificationData = params.get("notification");

    if (notificationData) {
        const data = JSON.parse(decodeURIComponent(notificationData));
        handleNotificationNavigation(data);
    }
}, []);
```

---

## 11. User Preferences Management

### 11.1 Preferences UI Screen

**NotificationSettingsScreen.js:**

```javascript
import React, { useState, useEffect } from "react";
import { View, Text, Switch, StyleSheet } from "react-native";

const NotificationSettingsScreen = () => {
    const [preferences, setPreferences] = useState({
        message: true,
        Service: true,
        review: true,
        post: true,
        Inquiry: true,
        userRegistration: true,
    });

    useEffect(() => {
        loadPreferences();
    }, []);

    const loadPreferences = async () => {
        // Fetch from backend
        const response = await fetch("https://api.jconnect.com/notification-toggles", {
            headers: {
                Authorization: `Bearer ${authToken}`,
            },
        });
        const data = await response.json();
        setPreferences(data);
    };

    const updatePreference = async (key, value) => {
        // Update locally
        setPreferences((prev) => ({ ...prev, [key]: value }));

        // Update backend
        await fetch("https://api.jconnect.com/notification-toggles", {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${authToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ [key]: value }),
        });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Notification Preferences</Text>

            <View style={styles.row}>
                <Text>Messages</Text>
                <Switch
                    value={preferences.message}
                    onValueChange={(val) => updatePreference("message", val)}
                />
            </View>

            <View style={styles.row}>
                <Text>Service Requests</Text>
                <Switch
                    value={preferences.Service}
                    onValueChange={(val) => updatePreference("Service", val)}
                />
            </View>

            <View style={styles.row}>
                <Text>Reviews</Text>
                <Switch
                    value={preferences.review}
                    onValueChange={(val) => updatePreference("review", val)}
                />
            </View>

            <View style={styles.row}>
                <Text>Posts</Text>
                <Switch
                    value={preferences.post}
                    onValueChange={(val) => updatePreference("post", val)}
                />
            </View>

            <View style={styles.row}>
                <Text>Profile Inquiries</Text>
                <Switch
                    value={preferences.Inquiry}
                    onValueChange={(val) => updatePreference("Inquiry", val)}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    title: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
    row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 15 },
});

export default NotificationSettingsScreen;
```

### 11.2 Backend Preference Sync

**Backend respects these preferences automatically.** When you disable a notification type in preferences, backend will not send notifications of that type.

---

## 12. Testing & Debugging

### 12.1 Testing Checklist

**Device Testing:**

- [ ] iOS physical device (push notifications don't work in simulator)
- [ ] Android physical device or emulator
- [ ] Web browser (Chrome, Safari, Firefox)

**Notification States:**

- [ ] App in foreground - notification displays
- [ ] App in background - notification appears in tray
- [ ] App killed - notification appears, tap opens app
- [ ] Notification tap - navigates to correct screen
- [ ] Badge count updates (iOS)

**Token Management:**

- [ ] Token registered on first app launch
- [ ] Token updates when refreshed
- [ ] Token sent to backend successfully
- [ ] Token persists across app restarts

### 12.2 Firebase Console Testing

**Send Test Notification:**

1. Go to Firebase Console → Cloud Messaging
2. Click "Send test message"
3. Enter your FCM token
4. Add notification title and body
5. Add custom data (JSON)
6. Click "Test"

### 12.3 Backend API Testing

**Using Postman/Curl:**

```bash
# Get test notification
curl -X POST https://api.jconnect.com/firebase-notifications/test/USER_ID \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

### 12.4 Debug Logging

**Enable verbose logging:**

```javascript
// React Native
import messaging from "@react-native-firebase/messaging";

messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log("Background notification:", JSON.stringify(remoteMessage, null, 2));
});

messaging().onMessage(async (remoteMessage) => {
    console.log("Foreground notification:", JSON.stringify(remoteMessage, null, 2));
});
```

**Check logs:**

- React Native: `npx react-native log-ios` or `npx react-native log-android`
- Flutter: `flutter logs`
- Web: Browser DevTools Console
- iOS: Xcode Console
- Android: Android Studio Logcat

### 12.5 Common Testing Issues

**Issue:** Notifications not received

**Debug Steps:**

1. Check FCM token is not null
2. Verify token sent to backend successfully
3. Check backend logs for send errors
4. Verify device has internet connection
5. Check notification permissions granted
6. Test with Firebase Console test message

**Issue:** Token registration fails

**Debug Steps:**

1. Check Firebase SDK initialized
2. Verify GoogleService-Info.plist / google-services.json present
3. Check API endpoint URL correct
4. Verify JWT token valid
5. Check network request in DevTools

---

## 13. Production Checklist

### 13.1 Pre-Launch

**Firebase Configuration:**

- [ ] Production Firebase project created
- [ ] iOS APNs certificate uploaded
- [ ] Android app registered with correct package name
- [ ] Web app registered with correct domain
- [ ] FCM server key secured

**App Configuration:**

- [ ] Firebase config files added to project
- [ ] API base URL points to production backend
- [ ] Error tracking integrated (Sentry, Crashlytics)
- [ ] Analytics tracking implemented
- [ ] Deep links configured

**Testing:**

- [ ] Tested on iOS physical devices (multiple models)
- [ ] Tested on Android devices (multiple OS versions)
- [ ] Tested on multiple browsers (Chrome, Safari, Firefox)
- [ ] Tested all notification types
- [ ] Tested deep link navigation
- [ ] Tested with poor network conditions
- [ ] Load tested with multiple devices

### 13.2 App Store Submission

**iOS:**

- [ ] Push Notifications capability enabled in Xcode
- [ ] Background Modes → Remote notifications enabled
- [ ] Privacy manifest includes notification usage description
- [ ] APNs certificate valid

**Android:**

- [ ] POST_NOTIFICATIONS permission in AndroidManifest.xml
- [ ] google-services.json in app directory
- [ ] Notification channels created for Android 8+
- [ ] Icons and sounds configured

**Web:**

- [ ] Service worker registered
- [ ] HTTPS enabled (required for Web Push)
- [ ] Manifest.json configured
- [ ] Firebase config in environment variables

### 13.3 Post-Launch Monitoring

**Metrics to Track:**

- Token registration success rate
- Notification delivery rate
- Notification open rate
- Error rate by platform
- User opt-out rate

**Monitoring Tools:**

- Firebase Console analytics
- Custom backend analytics
- Crash reporting (Firebase Crashlytics, Sentry)
- User feedback

---

## 14. Common Issues & Solutions

### 14.1 iOS: Notifications Not Received

**Symptoms:** iOS device doesn't receive notifications

**Solutions:**

1. **Physical device required:** Push notifications don't work in iOS Simulator
2. **APNs certificate:** Upload valid APNs certificate to Firebase Console
3. **Capabilities enabled:** Check Push Notifications and Background Modes in Xcode
4. **Permissions granted:** User must grant notification permission
5. **Production vs Development:** APNs has separate certificates for dev and production

### 14.2 Android: Token Registration Fails

**Symptoms:** `getToken()` returns null or error

**Solutions:**

1. **google-services.json:** Verify file is in `android/app/` directory
2. **Package name match:** Ensure AndroidManifest package matches Firebase
3. **Google Play Services:** Update Google Play Services on device
4. **Internet connection:** Device needs internet to register token
5. **SHA-1 certificate:** Add SHA-1 fingerprint to Firebase Console

### 14.3 Web: Service Worker Not Registered

**Symptoms:** Web push doesn't work

**Solutions:**

1. **HTTPS required:** Web Push only works on HTTPS (or localhost)
2. **Service worker path:** Ensure `firebase-messaging-sw.js` in public folder
3. **VAPID key:** Get VAPID key from Firebase Console
4. **Browser support:** Check browser supports Web Push
5. **Permissions blocked:** User may have blocked notifications

### 14.4 Token Not Updating Backend

**Symptoms:** Token sent but not saved in database

**Solutions:**

1. **JWT expired:** Re-login to get fresh JWT token
2. **API endpoint:** Verify endpoint URL is correct
3. **Network error:** Check device internet connection
4. **CORS error (web):** Backend must allow CORS for your domain
5. **Token format:** Ensure sending correct format to backend

### 14.5 Notification Doesn't Navigate

**Symptoms:** Tap notification but app doesn't navigate

**Solutions:**

1. **Deep link setup:** Verify deep link configuration
2. **Navigation ref:** Ensure navigation reference is accessible
3. **Data payload:** Check notification data contains navigation params
4. **Screen exists:** Verify screen name matches navigation stack
5. **Async issue:** Wrap navigation in setTimeout if too early

---

## 15. Additional Resources

### 15.1 Official Documentation

- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [React Native Firebase](https://rnfirebase.io/)
- [Firebase JS SDK](https://firebase.google.com/docs/web/setup)
- [Flutter Firebase](https://firebase.flutter.dev/)

### 15.2 Backend API Documentation

- Backend API Base URL: `https://api.jconnect.com`
- API Documentation: See `firebase-backend-notification-architecture.md`
- Notification Types: See backend `NotificationType` enum

### 15.3 Support

For implementation questions or issues:

- Check backend logs for token registration
- Test with Firebase Console test message
- Review notification permissions on device
- Contact backend team for API issues

---

**END OF FRONTEND IMPLEMENTATION GUIDE**

---

This guide covers everything you need to implement Firebase push notifications in your frontend application. Follow the platform-specific instructions for your tech stack (React Native, React Web, Flutter, iOS Native, or Android Native).

**Document Version:** 1.0  
**Last Updated:** March 2, 2026  
**Next Review:** June 2, 2026
