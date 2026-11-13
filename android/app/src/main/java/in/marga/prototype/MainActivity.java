package in.marga.prototype;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public final class MainActivity extends Activity {
    private static final int LOCATION_REQUEST = 1;
    private WebView web;
    private static final String APP_ORIGIN = "https://appassets.androidplatform.net";
    private GeolocationPermissions.Callback pendingLocation;
    private String pendingOrigin;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        openMap();
    }

    private boolean sameOrigin(Uri uri) {
        return "https".equals(uri.getScheme())
            && "appassets.androidplatform.net".equalsIgnoreCase(uri.getHost())
            && uri.getUserInfo() == null && (uri.getPort() == -1 || uri.getPort() == 443);
    }

    private void openMap() {
        web = new WebView(this);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setGeolocationEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (sameOrigin(uri)) return false;
                if (request.isForMainFrame() && request.hasGesture() && "https".equals(uri.getScheme())) {
                    Intent intent = new Intent(Intent.ACTION_VIEW, uri);
                    try { startActivity(intent); } catch (android.content.ActivityNotFoundException ignored) {}
                }
                return true;
            }
            @Override public android.webkit.WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!sameOrigin(uri)) return null;
                String path = uri.getPath();
                if (path == null || path.contains("..")) return null;
                if ("/marga-android.html".equals(path)) path = "/android.html";
                else if (!path.startsWith("/marga-bundled/") && !"/delhi-map.svg".equals(path)) return null;
                if (!"GET".equals(request.getMethod())) return null;
                String mime = path.endsWith(".js") ? "text/javascript"
                    : path.endsWith(".css") ? "text/css"
                    : path.endsWith(".svg") ? "image/svg+xml" : "text/html";
                try {
                    return new android.webkit.WebResourceResponse(mime, "UTF-8", getAssets().open(path.substring(1)));
                } catch (java.io.IOException error) {
                    return new android.webkit.WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                        java.util.Collections.emptyMap(), new java.io.ByteArrayInputStream(new byte[0]));
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                if (!sameOrigin(Uri.parse(origin)) || pendingLocation != null) {
                    callback.invoke(origin, false, false);
                } else if (canLocate()) {
                    callback.invoke(origin, true, false);
                } else {
                    pendingLocation = callback;
                    pendingOrigin = origin;
                    requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
                        Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_REQUEST);
                }
            }
        });
        setContentView(web);
        web.loadUrl(APP_ORIGIN + "/marga-android.html");
    }

    private boolean canLocate() {
        return checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            || checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
    }

    @Override public void onRequestPermissionsResult(int request, String[] permissions, int[] results) {
        super.onRequestPermissionsResult(request, permissions, results);
        if (request == LOCATION_REQUEST && pendingLocation != null) finishLocation(canLocate());
    }

    private void finishLocation(boolean allowed) {
        if (pendingLocation != null) pendingLocation.invoke(pendingOrigin, allowed, false);
        pendingLocation = null;
        pendingOrigin = null;
    }

    private void disposeMap() {
        finishLocation(false);
        if (web == null) return;
        if (web.getParent() instanceof ViewGroup) ((ViewGroup) web.getParent()).removeView(web);
        web.destroy();
        web = null;
    }

    @Override public void onBackPressed() {
        if (web == null) super.onBackPressed();
        else if (!(APP_ORIGIN + "/marga-android.html").equals(web.getUrl())) web.loadUrl(APP_ORIGIN + "/marga-android.html");
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        disposeMap();
        super.onDestroy();
    }
}
