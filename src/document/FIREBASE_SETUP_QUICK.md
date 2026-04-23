# 🔥 Firebase Authentication - Quick Setup

## 1️⃣ Add to .env file:

```env
# Firebase Configuration (Required for Google & Apple Sign-In)
FIREBASE_PROJECT_ID="your-firebase-project-id"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com"
```

## 2️⃣ Get Firebase Credentials:

### Step-by-Step:

1. Visit: https://console.firebase.google.com/
2. Select your project (or create new)
3. Click ⚙️ **Project Settings**
4. Go to **Service Accounts** tab
5. Click **"Generate New Private Key"** button
6. Download JSON file
7. Copy values from JSON to .env:
    ```
    project_id        → FIREBASE_PROJECT_ID
    private_key       → FIREBASE_PRIVATE_KEY
    client_email      → FIREBASE_CLIENT_EMAIL
    ```

## 3️⃣ Enable Authentication Providers:

### Google Sign-In:

1. Firebase Console → **Authentication**
2. Click **Sign-in method** tab
3. Enable **Google**
4. Add authorized domains

### Apple Sign-In:

1. Firebase Console → **Authentication**
2. Enable **Apple**
3. Configure with Apple Developer credentials

## 4️⃣ API Endpoint:

```
POST /auth/firebase-login
```

**Request:**

```json
{
    "idToken": "firebase-id-token-from-frontend",
    "provider": "google",
    "username": "optional_username"
}
```

**Response:**

```json
{
  "statusCode": 200,
  "success": true,
  "message": "User logged in successfully via google",
  "data": {
    "user": { ... },
    "token": "jwt-token"
  }
}
```

## 5️⃣ Frontend Example:

```typescript
// Sign in with Google
const result = await signInWithPopup(auth, new GoogleAuthProvider());
const idToken = await result.user.getIdToken();

// Send to backend
const response = await fetch("/auth/firebase-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
        idToken,
        provider: "google",
    }),
});
```

## ✅ Done!

Your backend now supports:

- ✨ Google Sign-In via Firebase
- 🍎 Apple Sign-In via Firebase
- 👤 Automatic username generation
- 🔐 JWT authentication
- 🍪 HTTP-only cookies
- 💳 Stripe customer creation

For detailed documentation, see: **FIREBASE_AUTH_SETUP.md**
