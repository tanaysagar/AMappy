package in.marga.prototype;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.text.InputType;
import android.view.ViewGroup;
import android.webkit.GeolocationPermissions;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

public final class MainActivity extends Activity {
    private static final int LOCATION_REQUEST = 1;
    private WebView web;
    private Uri server;
    private GeolocationPermissions.Callback pendingLocation;
    private String pendingOrigin;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        String saved = getPreferences(MODE_PRIVATE).getString("server", "");
        server = parseServer(saved);
        if (server == null) showSetup("Connect to your Marga server.", saved);
        else openMap();
    }

    private Uri parseServer(String value) {
        Uri uri = Uri.parse(value.trim());
        return "https".equals(uri.getScheme()) && uri.getHost() != null
            && uri.getUserInfo() == null && uri.getQuery() == null && uri.getFragment() == null
            ? uri : null;
    }

    private boolean sameOrigin(Uri uri) {
        if (server == null || !"https".equals(uri.getScheme())
            || !server.getHost().equalsIgnoreCase(uri.getHost()) || uri.getUserInfo() != null) return false;
        return (server.getPort() == -1 ? 443 : server.getPort()) == (uri.getPort() == -1 ? 443 : uri.getPort());
    }

    private void showSetup(String message, String value) {
        disposeMap();
        LinearLayout form = new LinearLayout(this);
        form.setOrientation(LinearLayout.VERTICAL);
        int padding = (int) (24 * getResources().getDisplayMetrics().density);
        form.setPadding(padding, padding, padding, padding);
        TextView title = new TextView(this);
        title.setText("Marga");
        title.setTextSize(28);
        form.addView(title);
        TextView help = new TextView(this);
        help.setText(message);
        form.addView(help);
        EditText address = new EditText(this);
        address.setHint("https://your-marga-server");
        address.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        address.setSingleLine(true);
        address.setText(value);
        form.addView(address);
        Button open = new Button(this);
        open.setText("Open map");
        open.setOnClickListener(view -> {
            Uri candidate = parseServer(address.getText().toString());
            if (candidate == null) { address.setError("Enter a trusted HTTPS address"); return; }
            server = candidate;
            getPreferences(MODE_PRIVATE).edit().putString("server", server.toString()).apply();
            openMap();
        });
        form.addView(open);
        setContentView(form);
        form.setFocusableInTouchMode(true);
        form.requestFocus();
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
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame() && view == web) {
                    view.post(() -> {
                        if (view == web) showSetup("Could not reach Marga. Check your connection and server address.", server.toString());
                    });
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
        web.loadUrl(server.toString());
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
        ((ViewGroup) web.getParent()).removeView(web);
        web.destroy();
        web = null;
    }

    @Override public void onBackPressed() {
        if (web == null) super.onBackPressed();
        else if (web.canGoBack()) web.goBack();
        else showSetup("Change your server or reopen the map.", server.toString());
    }

    @Override protected void onDestroy() {
        disposeMap();
        super.onDestroy();
    }
}
