# Insight for Android

Insight 1.0.0 is packaged as `com.groquik.insight` for Android 8 and later with an updated Android System WebView. On first launch, enter the HTTPS origin of the deployed Insight backend, then sign in with an Insight account. Use **More → Server connection** to change servers. Use **Open invitation or account link** to paste a link from that same Insight server.

The app supports creator, brand, agency and client-review workspaces. The workspace switcher follows server memberships and client access. Platform-owner sessions are rejected for the Android client. The web app remains the platform administration entry point.

The APK bundles the React interface, campaign imagery and navigation assets. It uses the existing Express API, authenticated Socket.IO and MongoDB data. The backend must be reachable from the phone over HTTPS with a valid certificate. Set `APP_ORIGIN` to that exact origin and forward `/api/v1` and `/socket.io` to Express, including WebSocket upgrades. File uploads and exports use Android's system picker. API actions require a connection.

## Build

Install Node 24, JDK 21, Android SDK Platform 35 and Android SDK Build Tools 35.0.0. From the repository root:

```bash
npm ci
export ANDROID_HOME=/path/to/android-sdk
export INSIGHT_ANDROID_KEYSTORE=/path/to/insight-keystore.p12
export INSIGHT_ANDROID_KEY_ALIAS=insight
read -rs INSIGHT_ANDROID_KEY_PASSWORD
export INSIGHT_ANDROID_KEY_PASSWORD
./android/build-apk.sh android/build/Insight.apk
unset INSIGHT_ANDROID_KEY_PASSWORD
```

Use your own signing key for distribution. The supplied test APK was signed with a development certificate. Android updates must use the same application ID and signing certificate as the installed app.

## Verification

The APK was compiled, aligned, and verified using Android APK Signature Schemes v2 and v3. The creator home, workspace menu, account settings and client-review view were checked in a browser using sample records. Installation on a physical device and end-to-end login against a deployed backend still need verification.

For a distribution build, set `INSIGHT_ANDROID_BACKEND_ORIGIN` to the deployed
Insight HTTPS origin when running `./android/build-apk.sh`. A fresh install
opens sign-in directly using that origin. Existing installations retain their
saved server. Without an origin, the APK opens the test connection screen.
