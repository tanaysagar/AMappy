# Marga Android prototype

This APK loads your Marga server in Android WebView. Use a trusted HTTPS deployment of this checkout with access restricted to testers. A private GitHub repository does not make a deployed server private. Keep provider keys on the server and rotate any previously shared keys before deployment.

Build with Android SDK 35, JDK 17 and Gradle 8.9 using `gradle -p android :app:lintDebug :app:assembleDebug`. On the private GitHub repository you can also run **Android prototype** under Actions and download the debug APK from the workflow run. Install it on your test phone, open Marga Prototype and enter the HTTPS server address. Android Back returns to server setup when the map has no prior page.

Test address search, map pins, route preview and foreground GPS. Test both allowing and denying location. Typed guide questions are the baseline. Browser speech recognition and synthesis depend on Android WebView support. Background navigation is outside this prototype.

Trip and journal data stay in the WebView's local storage. Route and nearby requests still send location to the configured server and its providers. Use a test trip when recording or sharing screenshots.
