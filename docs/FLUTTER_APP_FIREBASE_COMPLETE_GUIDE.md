# Complete Flutter App - Firebase Push Notifications Implementation

**Version:** 1.0  
**Last Updated:** March 2, 2026  
**Backend:** JConnect API with Firebase Cloud Messaging  
**Flutter SDK:** 3.19.0 or higher  
**Platform Support:** iOS, Android

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Dependencies & Configuration](#2-dependencies--configuration)
3. [Project Structure](#3-project-structure)
4. [Core Services Implementation](#4-core-services-implementation)
5. [State Management](#5-state-management)
6. [UI Screens](#6-ui-screens)
7. [Navigation & Deep Linking](#7-navigation--deep-linking)
8. [Platform-Specific Configuration](#8-platform-specific-configuration)
9. [Testing Guide](#9-testing-guide)
10. [Deployment Checklist](#10-deployment-checklist)
11. [Complete Code Examples](#11-complete-code-examples)

---

## 1. Project Setup

### 1.1 Create Flutter Project

```bash
# Create new Flutter project
flutter create jconnect_app

cd jconnect_app

# Test the setup
flutter doctor
```

### 1.2 Firebase Project Setup

**Step 1: Firebase Console Setup**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create new project or select existing: `jconnect`
3. Enable Google Analytics (optional)

**Step 2: Add iOS App**

1. Click iOS icon in Firebase project
2. iOS Bundle ID: `com.jconnect.app`
3. App nickname: `JConnect iOS`
4. Download `GoogleService-Info.plist`

**Step 3: Add Android App**

1. Click Android icon in Firebase project
2. Android package name: `com.jconnect.app`
3. App nickname: `JConnect Android`
4. Download `google-services.json`
5. Add SHA-1 certificate fingerprint (for authentication)

**Get SHA-1 Fingerprint:**

```bash
# Debug certificate
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android

# Production certificate (if you have)
keytool -list -v -keystore /path/to/your-release-key.keystore -alias your-key-alias
```

**Step 4: Enable Cloud Messaging**

1. Firebase Console → Project Settings → Cloud Messaging
2. Note the Server Key (for testing)
3. For iOS: Upload APNs Authentication Key

**Get APNs Key:**

1. [Apple Developer Portal](https://developer.apple.com/account)
2. Certificates, Identifiers & Profiles → Keys
3. Create new key with Apple Push Notifications service enabled
4. Download `.p8` file
5. Upload to Firebase Console

---

## 2. Dependencies & Configuration

### 2.1 pubspec.yaml

```yaml
name: jconnect_app
description: JConnect - Service Marketplace App
publish_to: "none"
version: 1.0.0+1

environment:
    sdk: ">=3.0.0 <4.0.0"

dependencies:
    flutter:
        sdk: flutter

    # Firebase
    firebase_core: ^2.24.0
    firebase_messaging: ^14.7.0

    # Local Notifications
    flutter_local_notifications: ^16.3.0

    # State Management
    provider: ^6.1.1

    # HTTP & API
    http: ^1.1.2
    dio: ^5.4.0

    # Storage
    shared_preferences: ^2.2.2
    flutter_secure_storage: ^9.0.0

    # Navigation
    go_router: ^13.0.0

    # UI
    cupertino_icons: ^1.0.6
    flutter_svg: ^2.0.9
    cached_network_image: ^3.3.1

    # Utilities
    intl: ^0.19.0
    uuid: ^4.3.3
    logger: ^2.0.2

    # Permissions
    permission_handler: ^11.2.0

dev_dependencies:
    flutter_test:
        sdk: flutter
    flutter_lints: ^3.0.1

flutter:
    uses-material-design: true

    assets:
        - assets/images/
        - assets/icons/

    fonts:
        - family: Poppins
          fonts:
              - asset: assets/fonts/Poppins-Regular.ttf
              - asset: assets/fonts/Poppins-Bold.ttf
                weight: 700
```

### 2.2 Install Dependencies

```bash
flutter pub get
```

### 2.3 Firebase Configuration Files

**iOS - GoogleService-Info.plist**

Place downloaded file in: `ios/Runner/GoogleService-Info.plist`

**Android - google-services.json**

Place downloaded file in: `android/app/google-services.json`

---

## 3. Project Structure

```
jconnect_app/
├── lib/
│   ├── main.dart
│   ├── app.dart
│   ├── config/
│   │   ├── app_config.dart
│   │   ├── firebase_config.dart
│   │   └── router_config.dart
│   ├── core/
│   │   ├── constants/
│   │   │   ├── api_constants.dart
│   │   │   ├── notification_types.dart
│   │   │   └── route_constants.dart
│   │   ├── services/
│   │   │   ├── api_service.dart
│   │   │   ├── auth_service.dart
│   │   │   ├── notification_service.dart
│   │   │   ├── storage_service.dart
│   │   │   └── logger_service.dart
│   │   └── utils/
│   │       ├── notification_handler.dart
│   │       └── helpers.dart
│   ├── models/
│   │   ├── user_model.dart
│   │   ├── notification_model.dart
│   │   └── response_model.dart
│   ├── providers/
│   │   ├── auth_provider.dart
│   │   ├── notification_provider.dart
│   │   └── user_provider.dart
│   ├── screens/
│   │   ├── splash_screen.dart
│   │   ├── auth/
│   │   │   ├── login_screen.dart
│   │   │   └── register_screen.dart
│   │   ├── home/
│   │   │   └── home_screen.dart
│   │   ├── chat/
│   │   │   └── chat_screen.dart
│   │   ├── notifications/
│   │   │   ├── notifications_screen.dart
│   │   │   └── notification_settings_screen.dart
│   │   ├── profile/
│   │   │   └── profile_screen.dart
│   │   └── service/
│   │       └── service_request_screen.dart
│   └── widgets/
│       ├── custom_button.dart
│       ├── custom_text_field.dart
│       └── notification_card.dart
├── android/
├── ios/
├── assets/
│   ├── images/
│   ├── icons/
│   └── fonts/
└── test/
```

---

## 4. Core Services Implementation

### 4.1 API Constants

**lib/core/constants/api_constants.dart**

```dart
class ApiConstants {
  // Base URL
  static const String baseUrl = 'https://api.jconnect.com';

  // Auth Endpoints
  static const String loginEndpoint = '/auth/login';
  static const String registerEndpoint = '/auth/register';
  static const String logoutEndpoint = '/auth/logout';

  // Notification Endpoints
  static const String updateFcmTokenEndpoint = '/firebase-notifications/update-fcm-token';
  static const String subscribeTopicEndpoint = '/firebase-notifications/subscribe-topic';
  static const String unsubscribeTopicEndpoint = '/firebase-notifications/unsubscribe-topic';

  // User Endpoints
  static const String getUserEndpoint = '/users/me';
  static const String updateProfileEndpoint = '/users/profile';

  // Request timeout
  static const Duration timeout = Duration(seconds: 30);
}
```

### 4.2 Notification Types

**lib/core/constants/notification_types.dart**

```dart
enum NotificationType {
  newMessage('NEW_MESSAGE'),
  newFollower('NEW_FOLLOWER'),
  newLike('NEW_LIKE'),
  newComment('NEW_COMMENT'),
  serviceRequest('SERVICE_REQUEST'),
  orderUpdate('ORDER_UPDATE'),
  paymentReceived('PAYMENT_RECEIVED'),
  reviewReceived('REVIEW_RECEIVED'),
  announcement('ANNOUNCEMENT'),
  custom('CUSTOM');

  const NotificationType(this.value);
  final String value;

  static NotificationType fromString(String value) {
    return NotificationType.values.firstWhere(
      (type) => type.value == value,
      orElse: () => NotificationType.custom,
    );
  }
}

class NotificationData {
  final NotificationType type;
  final String? entityId;
  final String? conversationId;
  final String? senderId;
  final String? action;
  final String? timestamp;
  final Map<String, dynamic>? metadata;

  NotificationData({
    required this.type,
    this.entityId,
    this.conversationId,
    this.senderId,
    this.action,
    this.timestamp,
    this.metadata,
  });

  factory NotificationData.fromMap(Map<String, dynamic> map) {
    return NotificationData(
      type: NotificationType.fromString(map['type'] ?? ''),
      entityId: map['entityId'],
      conversationId: map['conversationId'],
      senderId: map['senderId'],
      action: map['action'],
      timestamp: map['timestamp'],
      metadata: map,
    );
  }
}
```

### 4.3 Storage Service

**lib/core/services/storage_service.dart**

```dart
import 'package:shared_preferences/shared_preferences.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  late SharedPreferences _prefs;
  final _secureStorage = const FlutterSecureStorage();

  // Initialize
  Future<void> init() async {
    _prefs = await SharedPreferences.getInstance();
  }

  // Auth Token (Secure)
  Future<void> saveAuthToken(String token) async {
    await _secureStorage.write(key: 'auth_token', value: token);
  }

  Future<String?> getAuthToken() async {
    return await _secureStorage.read(key: 'auth_token');
  }

  Future<void> deleteAuthToken() async {
    await _secureStorage.delete(key: 'auth_token');
  }

  // FCM Token
  Future<void> saveFcmToken(String token) async {
    await _prefs.setString('fcm_token', token);
  }

  String? getFcmToken() {
    return _prefs.getString('fcm_token');
  }

  // User Data
  Future<void> saveUserId(String userId) async {
    await _prefs.setString('user_id', userId);
  }

  String? getUserId() {
    return _prefs.getString('user_id');
  }

  Future<void> saveUserEmail(String email) async {
    await _prefs.setString('user_email', email);
  }

  String? getUserEmail() {
    return _prefs.getString('user_email');
  }

  // Notification Badge Count
  Future<void> saveBadgeCount(int count) async {
    await _prefs.setInt('badge_count', count);
  }

  int getBadgeCount() {
    return _prefs.getInt('badge_count') ?? 0;
  }

  // Clear All Data
  Future<void> clearAll() async {
    await _secureStorage.deleteAll();
    await _prefs.clear();
  }
}
```

### 4.4 Logger Service

**lib/core/services/logger_service.dart**

```dart
import 'package:logger/logger.dart';

class LoggerService {
  static final Logger _logger = Logger(
    printer: PrettyPrinter(
      methodCount: 0,
      errorMethodCount: 5,
      lineLength: 50,
      colors: true,
      printEmojis: true,
    ),
  );

  static void debug(String message) {
    _logger.d(message);
  }

  static void info(String message) {
    _logger.i(message);
  }

  static void warning(String message) {
    _logger.w(message);
  }

  static void error(String message, [dynamic error, StackTrace? stackTrace]) {
    _logger.e(message, error: error, stackTrace: stackTrace);
  }
}
```

### 4.5 API Service

**lib/core/services/api_service.dart**

```dart
import 'package:dio/dio.dart';
import '../constants/api_constants.dart';
import 'storage_service.dart';
import 'logger_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  late Dio _dio;
  final _storage = StorageService();

  void init() {
    _dio = Dio(BaseOptions(
      baseUrl: ApiConstants.baseUrl,
      connectTimeout: ApiConstants.timeout,
      receiveTimeout: ApiConstants.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    ));

    // Add interceptors
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        // Add auth token to all requests
        final token = await _storage.getAuthToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        LoggerService.debug('REQUEST: ${options.method} ${options.path}');
        return handler.next(options);
      },
      onResponse: (response, handler) {
        LoggerService.debug('RESPONSE: ${response.statusCode} ${response.requestOptions.path}');
        return handler.next(response);
      },
      onError: (error, handler) {
        LoggerService.error(
          'API ERROR: ${error.requestOptions.path}',
          error.response?.data ?? error.message,
        );
        return handler.next(error);
      },
    ));
  }

  // Generic GET request
  Future<Response> get(String endpoint, {Map<String, dynamic>? queryParameters}) async {
    try {
      return await _dio.get(endpoint, queryParameters: queryParameters);
    } catch (e) {
      rethrow;
    }
  }

  // Generic POST request
  Future<Response> post(String endpoint, {Map<String, dynamic>? data}) async {
    try {
      return await _dio.post(endpoint, data: data);
    } catch (e) {
      rethrow;
    }
  }

  // Generic PUT request
  Future<Response> put(String endpoint, {Map<String, dynamic>? data}) async {
    try {
      return await _dio.put(endpoint, data: data);
    } catch (e) {
      rethrow;
    }
  }

  // Generic DELETE request
  Future<Response> delete(String endpoint) async {
    try {
      return await _dio.delete(endpoint);
    } catch (e) {
      rethrow;
    }
  }
}
```

### 4.6 Auth Service

**lib/core/services/auth_service.dart**

```dart
import '../constants/api_constants.dart';
import 'api_service.dart';
import 'storage_service.dart';
import 'logger_service.dart';

class AuthService {
  final _api = ApiService();
  final _storage = StorageService();

  // Login
  Future<Map<String, dynamic>> login(String email, String password) async {
    try {
      final response = await _api.post(
        ApiConstants.loginEndpoint,
        data: {
          'email': email,
          'password': password,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;

        // Save auth token
        if (data['token'] != null) {
          await _storage.saveAuthToken(data['token']);
        }

        // Save user data
        if (data['user'] != null) {
          await _storage.saveUserId(data['user']['id']);
          await _storage.saveUserEmail(data['user']['email']);
        }

        LoggerService.info('Login successful');
        return {'success': true, 'data': data};
      }

      return {'success': false, 'message': 'Login failed'};
    } catch (e) {
      LoggerService.error('Login error', e);
      return {'success': false, 'message': e.toString()};
    }
  }

  // Register
  Future<Map<String, dynamic>> register(String email, String password, String name) async {
    try {
      final response = await _api.post(
        ApiConstants.registerEndpoint,
        data: {
          'email': email,
          'password': password,
          'name': name,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = response.data;

        // Save auth token
        if (data['token'] != null) {
          await _storage.saveAuthToken(data['token']);
        }

        LoggerService.info('Registration successful');
        return {'success': true, 'data': data};
      }

      return {'success': false, 'message': 'Registration failed'};
    } catch (e) {
      LoggerService.error('Registration error', e);
      return {'success': false, 'message': e.toString()};
    }
  }

  // Logout
  Future<void> logout() async {
    try {
      await _api.post(ApiConstants.logoutEndpoint);
    } catch (e) {
      LoggerService.warning('Logout API call failed: $e');
    } finally {
      // Clear local data regardless of API response
      await _storage.clearAll();
      LoggerService.info('Logout successful');
    }
  }

  // Check if user is logged in
  Future<bool> isLoggedIn() async {
    final token = await _storage.getAuthToken();
    return token != null && token.isNotEmpty;
  }
}
```

### 4.7 Notification Service (CRITICAL)

**lib/core/services/notification_service.dart**

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:permission_handler/permission_handler.dart';
import 'dart:io';
import '../constants/api_constants.dart';
import '../constants/notification_types.dart';
import 'api_service.dart';
import 'storage_service.dart';
import 'logger_service.dart';

// Top-level function for background message handler
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  LoggerService.info('Background message: ${message.messageId}');
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FirebaseMessaging _firebaseMessaging = FirebaseMessaging.instance;
  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();
  final _api = ApiService();
  final _storage = StorageService();

  // Callback for notification handling
  Function(NotificationData)? onNotificationReceived;
  Function(NotificationData)? onNotificationTapped;

  // Initialize Firebase Messaging
  Future<void> initialize() async {
    // Set background message handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Initialize local notifications
    await _initializeLocalNotifications();

    // Request permission
    final hasPermission = await requestPermission();

    if (hasPermission) {
      // Get FCM token
      final token = await getFCMToken();

      if (token != null) {
        // Save locally
        await _storage.saveFcmToken(token);

        // Send to backend
        await updateFCMTokenOnBackend(token);
      }

      // Setup listeners
      _setupMessageHandlers();

      // Listen for token refresh
      _firebaseMessaging.onTokenRefresh.listen((newToken) {
        LoggerService.info('FCM token refreshed: $newToken');
        _storage.saveFcmToken(newToken);
        updateFCMTokenOnBackend(newToken);
      });
    }
  }

  // Initialize local notifications
  Future<void> _initializeLocalNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );

    const settings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );

    await _localNotifications.initialize(
      settings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        if (response.payload != null) {
          _handleNotificationTap(response.payload!);
        }
      },
    );

    // Create Android notification channel
    if (Platform.isAndroid) {
      await _createNotificationChannels();
    }
  }

  // Create notification channels (Android)
  Future<void> _createNotificationChannels() async {
    const channel = AndroidNotificationChannel(
      'high_importance_channel',
      'High Importance Notifications',
      description: 'This channel is used for important notifications',
      importance: Importance.high,
    );

    await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);
  }

  // Request notification permission
  Future<bool> requestPermission() async {
    if (Platform.isIOS) {
      // iOS permission
      final settings = await _firebaseMessaging.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );

      if (settings.authorizationStatus == AuthorizationStatus.authorized) {
        LoggerService.info('iOS notification permission granted');
        return true;
      } else if (settings.authorizationStatus == AuthorizationStatus.provisional) {
        LoggerService.info('iOS provisional notification permission granted');
        return true;
      } else {
        LoggerService.warning('iOS notification permission denied');
        return false;
      }
    } else {
      // Android permission (Android 13+)
      final status = await Permission.notification.request();

      if (status.isGranted) {
        LoggerService.info('Android notification permission granted');
        return true;
      } else {
        LoggerService.warning('Android notification permission denied');
        return false;
      }
    }
  }

  // Get FCM token
  Future<String?> getFCMToken() async {
    try {
      final token = await _firebaseMessaging.getToken();
      LoggerService.info('FCM Token: $token');
      return token;
    } catch (e) {
      LoggerService.error('Error getting FCM token', e);
      return null;
    }
  }

  // Update FCM token on backend
  Future<bool> updateFCMTokenOnBackend(String fcmToken) async {
    try {
      final platform = Platform.isIOS ? 'ios' : 'android';

      final response = await _api.post(
        ApiConstants.updateFcmTokenEndpoint,
        data: {
          'fcmToken': fcmToken,
          'platform': platform,
        },
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        LoggerService.info('FCM token registered on backend');
        return true;
      }

      return false;
    } catch (e) {
      LoggerService.error('Error updating FCM token on backend', e);
      return false;
    }
  }

  // Setup message handlers
  void _setupMessageHandlers() {
    // FOREGROUND: App is open and in focus
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      LoggerService.info('Foreground notification: ${message.messageId}');

      // Parse notification data
      final notificationData = NotificationData.fromMap(message.data);

      // Callback
      onNotificationReceived?.call(notificationData);

      // Show local notification
      _showLocalNotification(message);

      // Update badge count
      _incrementBadgeCount();
    });

    // BACKGROUND/TERMINATED: User taps notification
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      LoggerService.info('Notification opened app: ${message.messageId}');

      final notificationData = NotificationData.fromMap(message.data);
      onNotificationTapped?.call(notificationData);
    });

    // Check if app opened from terminated state
    _firebaseMessaging.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        LoggerService.info('App opened from terminated state: ${message.messageId}');

        final notificationData = NotificationData.fromMap(message.data);
        onNotificationTapped?.call(notificationData);
      }
    });
  }

  // Show local notification (for foreground)
  Future<void> _showLocalNotification(RemoteMessage message) async {
    final notification = message.notification;

    if (notification == null) return;

    const androidDetails = AndroidNotificationDetails(
      'high_importance_channel',
      'High Importance Notifications',
      channelDescription: 'This channel is used for important notifications',
      importance: Importance.high,
      priority: Priority.high,
      icon: '@mipmap/ic_launcher',
    );

    const iosDetails = DarwinNotificationDetails(
      presentAlert: true,
      presentBadge: true,
      presentSound: true,
    );

    const details = NotificationDetails(
      android: androidDetails,
      iOS: iosDetails,
    );

    await _localNotifications.show(
      message.hashCode,
      notification.title ?? 'New Notification',
      notification.body ?? '',
      details,
      payload: message.data.toString(),
    );
  }

  // Handle notification tap
  void _handleNotificationTap(String payload) {
    try {
      // Parse payload and trigger callback
      LoggerService.info('Notification tapped with payload: $payload');
      // You can parse the payload and call onNotificationTapped
    } catch (e) {
      LoggerService.error('Error handling notification tap', e);
    }
  }

  // Subscribe to topic
  Future<bool> subscribeToTopic(String topic) async {
    try {
      await _firebaseMessaging.subscribeToTopic(topic);

      // Also update backend
      await _api.post(
        ApiConstants.subscribeTopicEndpoint,
        data: {'topic': topic},
      );

      LoggerService.info('Subscribed to topic: $topic');
      return true;
    } catch (e) {
      LoggerService.error('Error subscribing to topic', e);
      return false;
    }
  }

  // Unsubscribe from topic
  Future<bool> unsubscribeFromTopic(String topic) async {
    try {
      await _firebaseMessaging.unsubscribeFromTopic(topic);

      // Also update backend
      await _api.post(
        ApiConstants.unsubscribeTopicEndpoint,
        data: {'topic': topic},
      );

      LoggerService.info('Unsubscribed from topic: $topic');
      return true;
    } catch (e) {
      LoggerService.error('Error unsubscribing from topic', e);
      return false;
    }
  }

  // Badge management
  Future<void> _incrementBadgeCount() async {
    final currentCount = _storage.getBadgeCount();
    await _storage.saveBadgeCount(currentCount + 1);
  }

  Future<void> clearBadgeCount() async {
    await _storage.saveBadgeCount(0);
  }

  int getBadgeCount() {
    return _storage.getBadgeCount();
  }
}
```

---

## 5. State Management

### 5.1 Auth Provider

**lib/providers/auth_provider.dart**

```dart
import 'package:flutter/material.dart';
import '../core/services/auth_service.dart';
import '../core/services/notification_service.dart';
import '../core/services/logger_service.dart';

class AuthProvider with ChangeNotifier {
  final _authService = AuthService();
  final _notificationService = NotificationService();

  bool _isLoading = false;
  bool _isAuthenticated = false;
  String? _errorMessage;

  bool get isLoading => _isLoading;
  bool get isAuthenticated => _isAuthenticated;
  String? get errorMessage => _errorMessage;

  // Check authentication status
  Future<void> checkAuthStatus() async {
    _isAuthenticated = await _authService.isLoggedIn();
    notifyListeners();
  }

  // Login
  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _authService.login(email, password);

      if (result['success'] == true) {
        _isAuthenticated = true;
        _isLoading = false;
        notifyListeners();

        // Initialize notifications after login
        await _notificationService.initialize();

        // Subscribe to topics
        await _notificationService.subscribeToTopic('all_users');

        return true;
      } else {
        _errorMessage = result['message'] ?? 'Login failed';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'An error occurred: $e';
      _isLoading = false;
      notifyListeners();
      LoggerService.error('Login error in provider', e);
      return false;
    }
  }

  // Register
  Future<bool> register(String email, String password, String name) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final result = await _authService.register(email, password, name);

      if (result['success'] == true) {
        _isAuthenticated = true;
        _isLoading = false;
        notifyListeners();

        // Initialize notifications after registration
        await _notificationService.initialize();
        await _notificationService.subscribeToTopic('all_users');

        return true;
      } else {
        _errorMessage = result['message'] ?? 'Registration failed';
        _isLoading = false;
        notifyListeners();
        return false;
      }
    } catch (e) {
      _errorMessage = 'An error occurred: $e';
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  // Logout
  Future<void> logout() async {
    await _authService.logout();
    _isAuthenticated = false;
    notifyListeners();
  }

  // Clear error
  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
```

### 5.2 Notification Provider

**lib/providers/notification_provider.dart**

```dart
import 'package:flutter/material.dart';
import '../core/constants/notification_types.dart';
import '../core/services/notification_service.dart';

class NotificationProvider with ChangeNotifier {
  final _notificationService = NotificationService();

  int _badgeCount = 0;
  NotificationData? _lastNotification;

  int get badgeCount => _badgeCount;
  NotificationData? get lastNotification => _lastNotification;

  void initialize() {
    _badgeCount = _notificationService.getBadgeCount();

    // Set up callbacks
    _notificationService.onNotificationReceived = (data) {
      _lastNotification = data;
      _badgeCount++;
      notifyListeners();
    };

    _notificationService.onNotificationTapped = (data) {
      _lastNotification = data;
      notifyListeners();
    };
  }

  Future<void> clearBadge() async {
    await _notificationService.clearBadgeCount();
    _badgeCount = 0;
    notifyListeners();
  }

  Future<bool> subscribeToTopic(String topic) async {
    return await _notificationService.subscribeToTopic(topic);
  }

  Future<bool> unsubscribeFromTopic(String topic) async {
    return await _notificationService.unsubscribeFromTopic(topic);
  }
}
```

---

## 6. UI Screens

### 6.1 Main App Entry

**lib/main.dart**

```dart
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'app.dart';
import 'core/services/storage_service.dart';
import 'core/services/api_service.dart';
import 'core/services/notification_service.dart';
import 'providers/auth_provider.dart';
import 'providers/notification_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Firebase
  await Firebase.initializeApp();

  // Initialize services
  await StorageService().init();
  ApiService().init();

  // Run app
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
        ChangeNotifierProvider(create: (_) => NotificationProvider()..initialize()),
      ],
      child: const JConnectApp(),
    ),
  );
}
```

**lib/app.dart**

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'providers/auth_provider.dart';
import 'screens/splash_screen.dart';
import 'screens/auth/login_screen.dart';
import 'screens/auth/register_screen.dart';
import 'screens/home/home_screen.dart';
import 'screens/chat/chat_screen.dart';
import 'screens/notifications/notifications_screen.dart';
import 'screens/notifications/notification_settings_screen.dart';
import 'screens/profile/profile_screen.dart';
import 'screens/service/service_request_screen.dart';

class JConnectApp extends StatelessWidget {
  const JConnectApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'JConnect',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      routerConfig: _router,
      debugShowCheckedModeBanner: false,
    );
  }

  static final _router = GoRouter(
    initialLocation: '/splash',
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/home',
        builder: (context, state) => const HomeScreen(),
      ),
      GoRoute(
        path: '/chat/:conversationId',
        builder: (context, state) {
          final conversationId = state.pathParameters['conversationId']!;
          return ChatScreen(conversationId: conversationId);
        },
      ),
      GoRoute(
        path: '/notifications',
        builder: (context, state) => const NotificationsScreen(),
      ),
      GoRoute(
        path: '/notification-settings',
        builder: (context, state) => const NotificationSettingsScreen(),
      ),
      GoRoute(
        path: '/profile/:userId',
        builder: (context, state) {
          final userId = state.pathParameters['userId']!;
          return ProfileScreen(userId: userId);
        },
      ),
      GoRoute(
        path: '/service-request/:requestId',
        builder: (context, state) {
          final requestId = state.pathParameters['requestId']!;
          return ServiceRequestScreen(requestId: requestId);
        },
      ),
    ],
  );
}
```

### 6.2 Splash Screen

**lib/screens/splash_screen.dart**

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';
import '../core/services/notification_service.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {

  @override
  void initState() {
    super.initState();
    _initialize();
  }

  Future<void> _initialize() async {
    final authProvider = context.read<AuthProvider>();

    // Check auth status
    await authProvider.checkAuthStatus();

    // If authenticated, initialize notifications
    if (authProvider.isAuthenticated) {
      await NotificationService().initialize();
    }

    // Navigate
    await Future.delayed(const Duration(seconds: 2));

    if (mounted) {
      if (authProvider.isAuthenticated) {
        context.go('/home');
      } else {
        context.go('/login');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Your app logo
            Icon(Icons.connect_without_contact, size: 100, color: Colors.blue),
            const SizedBox(height: 20),
            const Text(
              'JConnect',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 40),
            const CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
```

### 6.3 Login Screen

**lib/screens/auth/login_screen.dart**

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = context.read<AuthProvider>();

    final success = await authProvider.login(
      _emailController.text.trim(),
      _passwordController.text,
    );

    if (mounted) {
      if (success) {
        context.go('/home');
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(authProvider.errorMessage ?? 'Login failed'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Login'),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Form(
            key: _formKey,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Logo
                const Icon(Icons.connect_without_contact, size: 80, color: Colors.blue),
                const SizedBox(height: 40),

                // Email field
                TextFormField(
                  controller: _emailController,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    border: OutlineInputBorder(),
                    prefixIcon: Icon(Icons.email),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your email';
                    }
                    if (!value.contains('@')) {
                      return 'Please enter a valid email';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 16),

                // Password field
                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    border: const OutlineInputBorder(),
                    prefixIcon: const Icon(Icons.lock),
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility : Icons.visibility_off),
                      onPressed: () {
                        setState(() {
                          _obscurePassword = !_obscurePassword;
                        });
                      },
                    ),
                  ),
                  validator: (value) {
                    if (value == null || value.isEmpty) {
                      return 'Please enter your password';
                    }
                    if (value.length < 6) {
                      return 'Password must be at least 6 characters';
                    }
                    return null;
                  },
                ),
                const SizedBox(height: 24),

                // Login button
                Consumer<AuthProvider>(
                  builder: (context, authProvider, child) {
                    return SizedBox(
                      width: double.infinity,
                      height: 50,
                      child: ElevatedButton(
                        onPressed: authProvider.isLoading ? null : _login,
                        child: authProvider.isLoading
                            ? const CircularProgressIndicator()
                            : const Text('Login', style: TextStyle(fontSize: 18)),
                      ),
                    );
                  },
                ),
                const SizedBox(height: 16),

                // Register link
                TextButton(
                  onPressed: () => context.go('/register'),
                  child: const Text('Don\'t have an account? Register'),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
```

### 6.4 Home Screen with Notification Badge

**lib/screens/home/home_screen.dart**

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import '../../providers/auth_provider.dart';
import '../../providers/notification_provider.dart';
import '../../core/constants/notification_types.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {

  @override
  void initState() {
    super.initState();
    _setupNotificationHandling();
  }

  void _setupNotificationHandling() {
    final notificationProvider = context.read<NotificationProvider>();

    // Listen for notification taps to navigate
    notificationProvider.addListener(() {
      final lastNotification = notificationProvider.lastNotification;

      if (lastNotification != null) {
        _handleNotificationNavigation(lastNotification);
      }
    });
  }

  void _handleNotificationNavigation(NotificationData data) {
    switch (data.type) {
      case NotificationType.newMessage:
        if (data.conversationId != null) {
          context.push('/chat/${data.conversationId}');
        }
        break;
      case NotificationType.serviceRequest:
        if (data.entityId != null) {
          context.push('/service-request/${data.entityId}');
        }
        break;
      case NotificationType.newFollower:
        if (data.entityId != null) {
          context.push('/profile/${data.entityId}');
        }
        break;
      default:
        context.push('/notifications');
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('JConnect'),
        actions: [
          // Notification bell with badge
          Consumer<NotificationProvider>(
            builder: (context, notificationProvider, child) {
              return Stack(
                children: [
                  IconButton(
                    icon: const Icon(Icons.notifications),
                    onPressed: () {
                      notificationProvider.clearBadge();
                      context.push('/notifications');
                    },
                  ),
                  if (notificationProvider.badgeCount > 0)
                    Positioned(
                      right: 8,
                      top: 8,
                      child: Container(
                        padding: const EdgeInsets.all(4),
                        decoration: const BoxDecoration(
                          color: Colors.red,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '${notificationProvider.badgeCount}',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                ],
              );
            },
          ),
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: () => context.push('/notification-settings'),
          ),
        ],
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              'Welcome to JConnect!',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 20),
            const Text('Your notifications are enabled'),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: () async {
                final authProvider = context.read<AuthProvider>();
                await authProvider.logout();
                if (mounted) {
                  context.go('/login');
                }
              },
              child: const Text('Logout'),
            ),
          ],
        ),
      ),
    );
  }
}
```

### 6.5 Notification Settings Screen

**lib/screens/notifications/notification_settings_screen.dart**

```dart
import 'package:flutter/material.dart';

class NotificationSettingsScreen extends StatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  State<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends State<NotificationSettingsScreen> {
  Map<String, bool> _preferences = {
    'message': true,
    'Service': true,
    'review': true,
    'post': true,
    'Inquiry': true,
    'userRegistration': true,
  };

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notification Settings'),
      ),
      body: ListView(
        children: [
          _buildPreferenceItem(
            'Messages',
            'Receive notifications for new messages',
            'message',
          ),
          _buildPreferenceItem(
            'Service Requests',
            'Receive notifications for service requests',
            'Service',
          ),
          _buildPreferenceItem(
            'Reviews',
            'Receive notifications for new reviews',
            'review',
          ),
          _buildPreferenceItem(
            'Posts',
            'Receive notifications for new posts',
            'post',
          ),
          _buildPreferenceItem(
            'Profile Inquiries',
            'Receive notifications when someone views your profile',
            'Inquiry',
          ),
        ],
      ),
    );
  }

  Widget _buildPreferenceItem(String title, String subtitle, String key) {
    return SwitchListTile(
      title: Text(title),
      subtitle: Text(subtitle),
      value: _preferences[key] ?? true,
      onChanged: (value) {
        setState(() {
          _preferences[key] = value;
        });
        // TODO: Update backend with new preference
      },
    );
  }
}
```

---

## 7. Navigation & Deep Linking

### 7.1 Notification Handler Utility

**lib/core/utils/notification_handler.dart**

```dart
import 'package:go_router/go_router.dart';
import '../constants/notification_types.dart';
import '../services/logger_service.dart';

class NotificationHandler {
  static void handleNotification(NotificationData data, GoRouter router) {
    LoggerService.info('Handling notification: ${data.type}');

    switch (data.type) {
      case NotificationType.newMessage:
        if (data.conversationId != null) {
          router.push('/chat/${data.conversationId}');
        }
        break;

      case NotificationType.serviceRequest:
        if (data.entityId != null) {
          router.push('/service-request/${data.entityId}');
        }
        break;

      case NotificationType.orderUpdate:
        if (data.entityId != null) {
          router.push('/order/${data.entityId}');
        }
        break;

      case NotificationType.newFollower:
      case NotificationType.reviewReceived:
        if (data.entityId != null) {
          router.push('/profile/${data.entityId}');
        }
        break;

      case NotificationType.announcement:
        router.push('/announcements');
        break;

      default:
        router.push('/notifications');
    }
  }
}
```

---

## 8. Platform-Specific Configuration

### 8.1 Android Configuration

**android/app/build.gradle**

```gradle
apply plugin: 'com.android.application'
apply plugin: 'kotlin-android'
apply from: "$flutterRoot/packages/flutter_tools/gradle/flutter.gradle"

// Add this line
apply plugin: 'com.google.gms.google-services'

android {
    namespace "com.jconnect.app"
    compileSdkVersion 34
    ndkVersion flutter.ndkVersion

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_1_8
        targetCompatibility JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = '1.8'
    }

    defaultConfig {
        applicationId "com.jconnect.app"
        minSdkVersion 21
        targetSdkVersion 34
        versionCode flutterVersionCode.toInteger()
        versionName flutterVersionName
    }

    buildTypes {
        release {
            signingConfig signingConfigs.debug
        }
    }
}

dependencies {
    implementation 'com.google.firebase:firebase-messaging:23.4.0'
}
```

**android/build.gradle (project level)**

```gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }

    dependencies {
        classpath 'com.android.tools.build:gradle:8.1.0'
        classpath 'org.jetbrains.kotlin:kotlin-gradle-plugin:1.8.22'
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

**android/app/src/main/AndroidManifest.xml**

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <uses-permission android:name="android.permission.INTERNET"/>
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

    <application
        android:label="JConnect"
        android:name="${applicationName}"
        android:icon="@mipmap/ic_launcher">

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">

            <meta-data
              android:name="io.flutter.embedding.android.NormalTheme"
              android:resource="@style/NormalTheme"
              />

            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>

        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />

        <!-- Firebase Cloud Messaging -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_channel_id"
            android:value="high_importance_channel"/>
    </application>
</manifest>
```

### 8.2 iOS Configuration

**ios/Runner/Info.plist**

Add before `</dict>`:

```xml
<key>UIBackgroundModes</key>
<array>
    <string>fetch</string>
    <string>remote-notification</string>
</array>

<key>FirebaseAppDelegateProxyEnabled</key>
<false/>
```

**ios/Runner/AppDelegate.swift**

```swift
import UIKit
import Flutter
import Firebase
import UserNotifications

@UIApplicationMain
@objc class AppDelegate: FlutterAppDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {

    // Initialize Firebase
    FirebaseApp.configure()

    // Register for remote notifications
    if #available(iOS 10.0, *) {
      UNUserNotificationCenter.current().delegate = self
    }

    application.registerForRemoteNotifications()

    GeneratedPluginRegistrant.register(with: self)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
}
```

**ios/Podfile**

```ruby
platform :ios, '13.0'

target 'Runner' do
  use_frameworks!
  use_modular_headers!

  flutter_install_all_ios_pods File.dirname(File.realpath(__FILE__))

  # Firebase
  pod 'Firebase/Messaging'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    flutter_additional_ios_build_settings(target)
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '13.0'
    end
  end
end
```

**Install Pods:**

```bash
cd ios
pod install
cd ..
```

**Xcode Capabilities:**

1. Open `ios/Runner.xcworkspace` in Xcode
2. Select Runner target → Signing & Capabilities
3. Click + Capability
4. Add:
    - Push Notifications
    - Background Modes → Remote notifications

---

## 9. Testing Guide

### 9.1 Testing Checklist

```markdown
## Pre-Testing Setup

- [ ] Firebase project configured
- [ ] google-services.json added (Android)
- [ ] GoogleService-Info.plist added (iOS)
- [ ] APNs certificate uploaded (iOS)
- [ ] SHA-1 fingerprint added (Android)
- [ ] Backend API accessible

## Device Testing

- [ ] iOS physical device (simulator doesn't support push)
- [ ] Android physical device or emulator
- [ ] Both devices connected to internet

## Token Registration

- [ ] App requests notification permission
- [ ] FCM token generated successfully
- [ ] Token sent to backend API
- [ ] Token visible in backend logs/database

## Notification Reception

- [ ] Foreground: Custom notification displays
- [ ] Background: System notification appears
- [ ] Killed: System notification appears
- [ ] Tap notification: App opens
- [ ] Deep link navigation works

## Notification Types

- [ ] NEW_MESSAGE → Chat screen
- [ ] SERVICE_REQUEST → Service request screen
- [ ] ORDER_UPDATE → Order details screen
- [ ] NEW_FOLLOWER → Profile screen
- [ ] ANNOUNCEMENT → Announcements

## Edge Cases

- [ ] App reinstall (new token generation)
- [ ] Logout (token cleared)
- [ ] Login (token registered)
- [ ] Poor network (notification queued)
- [ ] Permission denied (graceful handling)
```

### 9.2 Testing Commands

**Run on Android:**

```bash
flutter run -d android
```

**Run on iOS:**

```bash
flutter run -d ios
```

**View Logs:**

```bash
flutter logs
```

**Test Notification via Firebase Console:**

1. Firebase Console → Cloud Messaging
2. Send test message
3. Add FCM token (from app logs)
4. Add notification title/body
5. Add custom data: `{ "type": "NEW_MESSAGE", "conversationId": "123" }`
6. Send

**Test via Backend API:**

```bash
curl -X POST https://api.jconnect.com/firebase-notifications/test/USER_ID \
  -H "Authorization: Bearer JWT_TOKEN"
```

---

## 10. Deployment Checklist

### 10.1 Pre-Release

```markdown
## Code Quality

- [ ] All compilation errors fixed
- [ ] No debug print statements
- [ ] Error handling implemented
- [ ] Loading states handled
- [ ] Null safety enforced

## Firebase

- [ ] Production Firebase project
- [ ] Production APNs certificate (iOS)
- [ ] Production google-services.json (Android)
- [ ] API base URL points to production

## Security

- [ ] API keys secured
- [ ] No hardcoded credentials
- [ ] HTTPS enforced
- [ ] JWT token secured in Flutter Secure Storage

## Testing

- [ ] Tested on iOS physical devices (multiple models)
- [ ] Tested on Android devices (multiple OS versions)
- [ ] Tested all notification flows
- [ ] Tested deep linking
- [ ] Load tested

## App Store Assets

- [ ] App icon (1024x1024)
- [ ] Screenshots (all sizes)
- [ ] App description
- [ ] Privacy policy
- [ ] Terms of service
```

### 10.2 iOS Deployment

**Build for Release:**

```bash
flutter build ios --release
```

**Archive in Xcode:**

1. Open `ios/Runner.xcworkspace` in Xcode
2. Product → Archive
3. Upload to App Store Connect
4. Fill app information
5. Submit for review

### 10.3 Android Deployment

**Generate Keystore:**

```bash
keytool -genkey -v -keystore ~/jconnect-release-key.jks -keyalg RSA -keysize 2048 -validity 10000 -alias jconnect
```

**android/key.properties:**

```properties
storePassword=your_store_password
keyPassword=your_key_password
keyAlias=jconnect
storeFile=/path/to/jconnect-release-key.jks
```

**android/app/build.gradle:**

```gradle
def keystoreProperties = new Properties()
def keystorePropertiesFile = rootProject.file('key.properties')
if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))
}

android {
    signingConfigs {
        release {
            keyAlias keystoreProperties['keyAlias']
            keyPassword keystoreProperties['keyPassword']
            storeFile keystoreProperties['storeFile'] ? file(keystoreProperties['storeFile']) : null
            storePassword keystoreProperties['storePassword']
        }
    }

    buildTypes {
        release {
            signingConfig signingConfigs.release
        }
    }
}
```

**Build for Release:**

```bash
flutter build appbundle --release
```

**Upload to Play Console:**

1. Google Play Console → Create app
2. Upload AAB file
3. Fill app information
4. Submit for review

---

## 11. Complete Code Examples

### 11.1 Chat Screen Example

**lib/screens/chat/chat_screen.dart**

```dart
import 'package:flutter/material.dart';

class ChatScreen extends StatelessWidget {
  final String conversationId;

  const ChatScreen({super.key, required this.conversationId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Chat'),
      ),
      body: Center(
        child: Text('Chat Screen - Conversation ID: $conversationId'),
      ),
    );
  }
}
```

### 11.2 Service Request Screen

**lib/screens/service/service_request_screen.dart**

```dart
import 'package:flutter/material.dart';

class ServiceRequestScreen extends StatelessWidget {
  final String requestId;

  const ServiceRequestScreen({super.key, required this.requestId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Service Request'),
      ),
      body: Center(
        child: Text('Service Request - ID: $requestId'),
      ),
    );
  }
}
```

### 11.3 Profile Screen

**lib/screens/profile/profile_screen.dart**

```dart
import 'package:flutter/material.dart';

class ProfileScreen extends StatelessWidget {
  final String userId;

  const ProfileScreen({super.key, required this.userId});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Profile'),
      ),
      body: Center(
        child: Text('Profile - User ID: $userId'),
      ),
    );
  }
}
```

### 11.4 Notifications List Screen

**lib/screens/notifications/notifications_screen.dart**

```dart
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/notification_provider.dart';

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () {
              context.read<NotificationProvider>().clearBadge();
            },
            child: const Text('Clear All', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
      body: ListView.builder(
        itemCount: 10,
        itemBuilder: (context, index) {
          return ListTile(
            leading: const CircleAvatar(
              child: Icon(Icons.notifications),
            ),
            title: Text('Notification $index'),
            subtitle: const Text('This is a notification message'),
            trailing: const Text('2h ago'),
            onTap: () {
              // Handle notification tap
            },
          );
        },
      ),
    );
  }
}
```

---

## 12. Troubleshooting

### Common Issues

**Issue: FCM token is null**

Solution:

- Check Firebase initialized in main.dart
- Verify google-services.json / GoogleService-Info.plist present
- Check internet connection
- For iOS: Test on physical device (not simulator)

**Issue: Notifications not received**

Solution:

- Verify token sent to backend successfully
- Check backend logs for send errors
- Verify notification permission granted
- Check Firebase Console for errors

**Issue: Deep linking not working**

Solution:

- Verify notification data contains correct fields
- Check route definitions in GoRouter
- Ensure navigation happens after app fully loaded

**Issue: Android build fails**

Solution:

- Verify google-services.json in android/app/
- Check google-services plugin applied in build.gradle
- Run `flutter clean && flutter pub get`

**Issue: iOS build fails**

Solution:

- Run `cd ios && pod install`
- Verify GoogleService-Info.plist in ios/Runner/
- Check deployment target is iOS 13.0 or higher

---

## 13. Additional Resources

- [Flutter Firebase Setup](https://firebase.flutter.dev/docs/overview)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Flutter Documentation](https://docs.flutter.dev/)
- [JConnect Backend API Docs](./firebase-backend-notification-architecture.md)

---

**END OF FLUTTER APP GUIDE**

This complete guide provides everything you need to build a production-ready Flutter app with Firebase push notifications integrated with your JConnect backend!

**Document Version:** 1.0  
**Last Updated:** March 2, 2026
