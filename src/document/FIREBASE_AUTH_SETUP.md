# Firebase Authentication Setup Guide (Google & Apple)

## Overview

This implementation adds Firebase authentication support for Google and Apple sign-in to your backend. The system follows your existing authentication patterns including username generation and verification.

## 🚀 Implementation Summary

### Files Created/Modified:

1. **New Files:**
    - `src/main/auth/dto/firebase-login.dto.ts` - DTO for Firebase authentication
    - `src/main/auth/services/auth-firebase.service.ts` - Firebase authentication service

2. **Modified Files:**
    - `src/main/auth/controllers/auth.controller.ts` - Added Firebase login endpoint
    - `src/main/auth/auth.module.ts` - Registered Firebase service
    - `src/common/enum/env.enum.ts` - Added Firebase environment variables
    - `.env.example` - Added Firebase configuration template
    - `package.json` - Added firebase-admin dependency

## 📦 Dependencies Installed

- `firebase-admin@13.6.0` - Firebase Admin SDK for backend

## 🔧 Environment Variables Setup

Add these variables to your `.env` file:

```env
# Firebase Configuration
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
```

### How to Get Firebase Credentials:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project (or create a new one)
3. Go to **Project Settings** (gear icon) → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Download the JSON file
6. Extract the following values from the JSON:
    - `project_id` → `FIREBASE_PROJECT_ID`
    - `private_key` → `FIREBASE_PRIVATE_KEY`
    - `client_email` → `FIREBASE_CLIENT_EMAIL`

**Important:** For `FIREBASE_PRIVATE_KEY`, keep the `\n` characters as they are in the JSON file.

## 📡 API Endpoint

### POST /auth/firebase-login

Firebase authentication endpoint for Google and Apple sign-in.

**Request Body:**

```json
{
    "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2...",
    "provider": "google",
    "username": "john_doe"
}
```

**Fields:**

- `idToken` (required): Firebase ID token from frontend
- `provider` (required): `"google"` or `"apple"`
- `username` (optional): Preferred username (auto-generated if not provided)

**Response (Success - 200):**

```json
{
  "statusCode": 200,
  "success": true,
  "message": "User logged in successfully via google",
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "username": "john_doe",
      "full_name": "John Doe",
      "isVerified": true,
      "role": "ARTIST",
      ...
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**HTTP-Only Cookie:**

- Cookie name: `token`
- Expires: 30 days
- Secure: true (in production)
- SameSite: lax

## 🎯 Features

### 1. **Automatic User Creation**

- Creates new users automatically on first login
- Follows your existing registration pattern
- Auto-generates unique username from full name
- Creates Stripe customer account
- Sets user as verified (Firebase already verified)

### 2. **Username Handling**

- Optional username in request body
- Auto-generates from full name if not provided
- Ensures uniqueness with timestamp/random suffix if needed
- Format: `name_timestamp_random` (e.g., `john_doe_1234567890_a1b2`)

### 3. **Provider Support**

- Google Sign-In
- Apple Sign-In
- Stores provider info in user record

### 4. **Security**

- Verifies Firebase ID token on backend
- Validates token signature and expiration
- Auto-expires tokens
- HTTP-only cookies prevent XSS attacks

### 5. **User Data**

- Extracts: email, name, Firebase UID
- Links Firebase UID to user record
- Updates existing users on subsequent logins
- Tracks last login timestamp

## 🔄 Flow Diagram

```
Frontend                Backend                   Firebase              Database
   |                       |                          |                     |
   |--1. Sign in with---->|                          |                     |
   |   Google/Apple       |                          |                     |
   |                      |                          |                     |
   |<--2. ID Token--------|                          |                     |
   |   from Firebase      |                          |                     |
   |                      |                          |                     |
   |--3. POST /auth----->|                          |                     |
   |   firebase-login     |                          |                     |
   |   {idToken, provider}|                          |                     |
   |                      |--4. Verify token-------->|                     |
   |                      |                          |                     |
   |                      |<--5. Decoded token-------|                     |
   |                      |   {uid, email, name}     |                     |
   |                      |                          |                     |
   |                      |--6. Find/Create user-------------------->|
   |                      |                          |                     |
   |                      |<--7. User record-----------------------|
   |                      |                          |                     |
   |                      |--8. Generate JWT-------->|                     |
   |                      |                          |                     |
   |<--9. User + token---|                          |                     |
   |   + HTTP-only cookie |                          |                     |
```

## 🔐 Frontend Integration

### Example: React with Firebase

```typescript
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, OAuthProvider } from "firebase/auth";

// Initialize Firebase
const firebaseConfig = {
    apiKey: "your-api-key",
    authDomain: "your-project.firebaseapp.com",
    projectId: "your-project-id",
    // ... other config
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Google Sign-In
async function signInWithGoogle() {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();

        // Send to backend
        const response = await fetch("http://your-backend/auth/firebase-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include", // Important for cookies
            body: JSON.stringify({
                idToken,
                provider: "google",
                username: "optional_username", // optional
            }),
        });

        const data = await response.json();
        console.log("Logged in:", data.data.user);
        // Token is in HTTP-only cookie automatically
    } catch (error) {
        console.error("Login failed:", error);
    }
}

// Apple Sign-In
async function signInWithApple() {
    const provider = new OAuthProvider("apple.com");
    try {
        const result = await signInWithPopup(auth, provider);
        const idToken = await result.user.getIdToken();

        // Send to backend
        const response = await fetch("http://your-backend/auth/firebase-login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                idToken,
                provider: "apple",
            }),
        });

        const data = await response.json();
        console.log("Logged in:", data.data.user);
    } catch (error) {
        console.error("Login failed:", error);
    }
}
```

## 🧪 Testing

### Using Thunder Client / Postman:

1. **Get Firebase ID Token from Frontend:**
    - User signs in with Google/Apple on frontend
    - Frontend gets ID token from Firebase
    - Copy the token

2. **Test Backend Endpoint:**

    ```
    POST http://localhost:3000/auth/firebase-login
    Content-Type: application/json

    {
      "idToken": "paste-your-token-here",
      "provider": "google",
      "username": "test_user"
    }
    ```

3. **Expected Response:**
    - Status: 200 OK
    - User object with token
    - Cookie set in browser

## ⚠️ Important Notes

1. **Firebase Setup:**
    - Enable Google and/or Apple authentication in Firebase Console
    - Configure OAuth consent screen
    - Add authorized domains

2. **Apple Sign-In Additional Setup:**
    - Register your app with Apple Developer Program
    - Configure Sign in with Apple capability
    - Add Service ID in Apple Developer Console
    - Link in Firebase Console

3. **Security:**
    - Never expose Firebase private key
    - Use environment variables
    - Keep `.env` out of version control
    - Use HTTPS in production

4. **Username Generation:**
    - Follows your existing pattern
    - Auto-generates if not provided
    - Ensures uniqueness
    - Uses format: `name_timestamp_random`

5. **Existing Google Login:**
    - Your existing `/auth/google-login` endpoint remains unchanged
    - New `/auth/firebase-login` provides more flexibility
    - Can support both simultaneously

## 📊 Database Schema

The implementation works with your existing User model. No schema changes required.

**Fields Used:**

- `email` - User's email (unique)
- `username` - Generated or provided username (unique)
- `full_name` - User's full name
- `googleId` - Firebase UID for Google (unique)
- `password` - Empty string for social login
- `isVerified` - Set to true (Firebase verified)
- `auth_provider` - "GOOGLE" or "APPLE"
- `role` - Default: "ARTIST"
- `customerIdStripe` - Stripe customer ID
- `last_login_at` - Timestamp
- `isLogin` - Set to true
- `login_attempts` - Reset to 0

## 🆘 Troubleshooting

### Error: "Firebase configuration is incomplete"

- Check all three environment variables are set
- Verify no extra spaces in values
- Ensure private key includes `\\n` characters

### Error: "Invalid Firebase token"

- Token expired (tokens expire in 1 hour)
- Wrong Firebase project
- Token from different Firebase project

### Error: "User already exists"

- Email already registered with different provider
- Can link accounts by updating provider

### Error: "Module 'firebase-admin' not found"

- Run: `pnpm install firebase-admin`
- Then: `npx prisma generate`

## 🎉 You're All Set!

Your backend now supports Firebase authentication with Google and Apple sign-in! Users can seamlessly sign in using their social accounts while maintaining your existing username and authentication flow.
