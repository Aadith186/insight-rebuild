package com.groquik.insight;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.text.InputType;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;

public final class MainActivity extends Activity {
    private static final String BUNDLE_ROOT = "/__insight_android__/";
    private static final String START_PATH = BUNDLE_ROOT + "index.html";
    private static final int PICK_FILE = 101;
    private static final int SAVE_FILE = 102;
    private static final int NAVY = 0xff003b59;
    private static final int GOLD = 0xffffb118;
    private static final int PAPER = 0xfff5f8fa;
    private static final int MAX_DOWNLOAD = 160 * 1024 * 1024;

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private FrameLayout root;
    private WebView web;
    private ValueCallback<Uri[]> pendingFiles;
    private volatile String origin;
    private File pendingDownload;
    private boolean downloading;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        root = new FrameLayout(this);
        root.setBackgroundColor(PAPER);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                android.graphics.Insets safe = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                view.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return insets;
            });
            WindowInsetsController controller = getWindow().getInsetsController();
            if (controller != null) controller.setSystemBarsAppearance(
                WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS | WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS,
                WindowInsetsController.APPEARANCE_LIGHT_NAVIGATION_BARS |
                WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
        }
        setContentView(root);
        root.requestApplyInsets();
        origin = getPreferences(MODE_PRIVATE).getString("backendOrigin", "");
        if (origin.isEmpty()) origin = configuredOrigin();
        if (origin.isEmpty()) showConnection();
        else showApp("/dashboard");
    }

    private String configuredOrigin() {
        try (InputStream input = getAssets().open("backend-origin.txt")) {
            byte[] buffer = new byte[512];
            int count = input.read(buffer);
            if (count > 0) return parseOrigin(new String(buffer, 0, count, java.nio.charset.StandardCharsets.UTF_8));
        } catch (IOException | IllegalArgumentException ignored) {
            // Test builds can connect to a server using the setup screen.
        }
        return "";
    }

    private int dp(float size) {
        return Math.round(size * getResources().getDisplayMetrics().density);
    }

    private GradientDrawable rounded(int color, int radius) {
        GradientDrawable shape = new GradientDrawable();
        shape.setColor(color);
        shape.setCornerRadius(dp(radius));
        return shape;
    }

    private TextView text(String value, float size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private Button button(String title, int background, int color) {
        Button button = new Button(this);
        button.setText(title);
        button.setTextColor(color);
        button.setAllCaps(false);
        button.setTextSize(15);
        button.setMinHeight(dp(50));
        button.setBackground(rounded(background, 13));
        return button;
    }

    private void add(LinearLayout layout, View view, int top) {
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.topMargin = dp(top);
        layout.addView(view, params);
    }

    private void showConnection() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        body.setPadding(dp(22), dp(25), dp(22), dp(25));
        scroll.addView(body);

        LinearLayout hero = new LinearLayout(this);
        hero.setOrientation(LinearLayout.VERTICAL);
        hero.setPadding(dp(20), dp(20), dp(20), dp(20));
        hero.setBackground(rounded(NAVY, 19));
        ImageView logo = new ImageView(this);
        logo.setImageResource(R.drawable.insight_icon);
        hero.addView(logo, new LinearLayout.LayoutParams(dp(52), dp(52)));
        add(hero, text("Insight", 30, Color.WHITE, true), 7);
        add(hero, text("Creators, brands and agencies", 14, 0xffd8e9f0, false), 4);
        add(body, hero, 0);
        add(body, text("Set up your test build", 24, NAVY, true), 26);
        add(body, text("Enter the server address supplied by your Insight administrator.", 14, 0xff475c6d, false), 7);
        EditText server = new EditText(this);
        server.setSingleLine(true);
        server.setTextSize(16);
        server.setHint("https://insight.yourcompany.com");
        server.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        server.setText(origin);
        server.setBackground(rounded(Color.WHITE, 13));
        server.setPadding(dp(13), dp(12), dp(13), dp(12));
        add(body, server, 17);
        TextView status = text("", 13, 0xffa13938, false);
        status.setAccessibilityLiveRegion(View.ACCESSIBILITY_LIVE_REGION_POLITE);
        add(body, status, 6);
        Button connect = button("Connect", GOLD, NAVY);
        add(body, connect, 9);
        connect.setOnClickListener(view -> {
            final String candidate;
            try {
                candidate = parseOrigin(server.getText().toString());
            } catch (IllegalArgumentException e) {
                status.setText(e.getMessage());
                return;
            }
            connect.setEnabled(false);
            status.setText("Checking connection…");
            worker.execute(() -> {
                try {
                    byte[] health = readUrl(candidate + "/api/v1/health/live", Collections.emptyMap(), 8192);
                    JSONObject payload = new JSONObject(new String(health, StandardCharsets.UTF_8));
                    if (!"ok".equals(payload.getJSONObject("data").optString("status"))) {
                        throw new IOException("Unrecognised health response");
                    }
                    runOnUiThread(() -> {
                        if (isFinishing() || isDestroyed()) return;
                        origin = candidate;
                        getPreferences(MODE_PRIVATE).edit().putString("backendOrigin", origin).apply();
                        showApp("/dashboard");
                    });
                } catch (Exception e) {
                    runOnUiThread(() -> {
                        connect.setEnabled(true);
                        status.setText("Could not reach Insight. Check the HTTPS address and try again.");
                    });
                }
            });
        });
        if (!origin.isEmpty()) {
            Button back = button("Back to Insight", Color.WHITE, NAVY);
            back.setOnClickListener(view -> {
                if (web != null) installView(web);
                else showApp("/dashboard");
            });
            add(body, back, 10);
        }
        installView(scroll);
    }

    private static String parseOrigin(String text) {
        try {
            URI uri = URI.create(text.trim());
            String path = uri.getRawPath();
            if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getHost() != null
                    && uri.getUserInfo() == null && uri.getRawQuery() == null
                    && uri.getRawFragment() == null && (path.isEmpty() || "/".equals(path))
                    && (uri.getPort() == -1 || uri.getPort() > 0 && uri.getPort() <= 65535)) {
                int port = uri.getPort();
                return "https://" + uri.getHost().toLowerCase(Locale.ROOT)
                    + (port == -1 || port == 443 ? "" : ":" + port);
            }
        } catch (IllegalArgumentException ignored) {
            // Report all malformed and unsupported URLs consistently.
        }
        throw new IllegalArgumentException("Use the HTTPS server address without a page path.");
    }

    private void installView(View view) {
        root.removeAllViews();
        root.addView(view, new FrameLayout.LayoutParams(-1, -1));
    }

    private boolean sameServer(Uri uri) {
        return "https".equals(uri.getScheme()) && uri.getUserInfo() == null
            && Uri.parse(origin).getHost().equalsIgnoreCase(uri.getHost())
            && effectivePort(uri) == effectivePort(Uri.parse(origin));
    }

    private static int effectivePort(Uri uri) {
        return uri.getPort() == -1 ? 443 : uri.getPort();
    }

    private void showApp(String route) {
        if (web != null) {
            root.removeView(web);
            web.destroy();
        }
        web = new WebView(this);
        web.setBackgroundColor(PAPER);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false);
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String path = uri.getPath();
                if (!sameServer(uri) || path == null || !path.startsWith(BUNDLE_ROOT)) return null;
                String asset = path.substring(BUNDLE_ROOT.length());
                if (!asset.matches("[A-Za-z0-9_./-]+") || asset.contains("..")) return missing();
                try {
                    InputStream input = getAssets().open("web/" + asset);
                    Map<String, String> headers = new LinkedHashMap<>();
                    headers.put("Cache-Control", "no-store");
                    headers.put("X-Content-Type-Options", "nosniff");
                    headers.put("Content-Security-Policy", contentPolicy());
                    return new WebResourceResponse(mime(asset), null, 200, "OK", headers, input);
                } catch (IOException e) {
                    return missing();
                }
            }

            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri uri = request.getUrl();
                if ("insight-app".equals(uri.getScheme())) {
                    handleAction(uri);
                    return true;
                }
                if (sameServer(uri) && START_PATH.equals(uri.getPath())) return false;
                if (sameServer(uri) && isMedia(uri.getPath())) {
                    prepareDownload(uri.getPath() + (uri.getEncodedQuery() == null ? "" : "?" + uri.getEncodedQuery()), "insight-attachment", Collections.emptyMap());
                    return true;
                }
                if ("https".equals(uri.getScheme())) openExternal(uri);
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams parameters) {
                if (pendingFiles != null) pendingFiles.onReceiveValue(null);
                pendingFiles = callback;
                try {
                    startActivityForResult(parameters.createIntent(), PICK_FILE);
                    return true;
                } catch (RuntimeException e) {
                    pendingFiles = null;
                    return false;
                }
            }
        });
        installView(web);
        web.loadUrl(origin + START_PATH + "#" + route);
    }

    private String contentPolicy() {
        return "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            + "img-src 'self' data: blob:; media-src 'self' https: blob:; "
            + "connect-src 'self' " + origin.replaceFirst("^https:", "wss:") + "; "
            + "frame-src https://www.youtube.com https://player.vimeo.com; "
            + "object-src 'none'; base-uri 'none'; form-action 'none'";
    }

    private static WebResourceResponse missing() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
            Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(new byte[0]));
    }

    private static String mime(String filename) {
        if (filename.endsWith(".html")) return "text/html";
        if (filename.endsWith(".js")) return "application/javascript";
        if (filename.endsWith(".css")) return "text/css";
        if (filename.endsWith(".jpg")) return "image/jpeg";
        if (filename.endsWith(".png")) return "image/png";
        if (filename.endsWith(".webp")) return "image/webp";
        if (filename.endsWith(".svg")) return "image/svg+xml";
        if (filename.endsWith(".woff2")) return "font/woff2";
        return "application/octet-stream";
    }

    private void handleAction(Uri uri) {
        String action = uri.getHost();
        if ("connection".equals(action)) {
            showConnection();
        } else if ("open-link".equals(action)) {
            showLinkPrompt();
        } else if ("download".equals(action)) {
            String path = uri.getQueryParameter("path");
            String name = uri.getQueryParameter("name");
            if (path == null || !path.matches("/api/v1/(ledger/export|reports/[A-Za-z0-9_-]+/[A-Za-z0-9_-]+/export)(\\?[^#]*)?")) {
                toast("Unsupported download.");
                return;
            }
            Map<String, String> headers = new LinkedHashMap<>();
            copyScope(uri, headers, "organizationId", "X-Organization-Id");
            copyScope(uri, headers, "clientId", "X-Client-Id");
            prepareDownload(path, name == null ? "insight-export.csv" : name, headers);
        }
    }

    private void showLinkPrompt() {
        EditText input = new EditText(this);
        input.setSingleLine(true);
        input.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_VARIATION_URI);
        input.setHint("Paste your Insight link");
        FrameLayout container = new FrameLayout(this);
        container.setPadding(dp(20), 0, dp(20), 0);
        container.addView(input);
        AlertDialog dialog = new AlertDialog.Builder(this)
            .setTitle("Open invitation or account link")
            .setView(container)
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Open", null)
            .create();
        dialog.setOnShowListener(ignored -> dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener(view -> {
            Uri link = Uri.parse(input.getText().toString().trim());
            String route = link.getEncodedFragment();
            if (!sameServer(link) || route == null
                    || !route.matches("/(invitation|verify-email|reset-password)([/?].*)?")) {
                input.setError("Paste an invitation or account link from this server.");
                return;
            }
            dialog.dismiss();
            web.loadUrl(origin + START_PATH + "#" + route);
        }));
        dialog.show();
    }

    private static void copyScope(Uri uri, Map<String, String> headers, String parameter, String header) {
        String value = uri.getQueryParameter(parameter);
        if (value != null && value.matches("[a-fA-F0-9]{24}")) headers.put(header, value);
    }

    private static boolean isMedia(String path) {
        return path != null && path.matches("/api/v1/media/assets/[a-fA-F0-9]{24}/content");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (RuntimeException e) {
            toast("No browser is available for this link.");
        }
    }

    private void prepareDownload(String path, String name, Map<String, String> scope) {
        if (downloading) {
            toast("A download is already open.");
            return;
        }
        downloading = true;
        final String url = origin + path;
        final Map<String, String> headers = new LinkedHashMap<>(scope);
        String cookie = CookieManager.getInstance().getCookie(origin);
        if (cookie != null) headers.put("Cookie", cookie);
        headers.put("X-Insight-Client", "android");
        toast("Preparing download…");
        worker.execute(() -> {
            File staging = null;
            try {
                staging = File.createTempFile("insight-download-", ".tmp", getCacheDir());
                HttpURLConnection connection = connect(url, headers);
                final String contentType;
                try {
                    contentType = connection.getContentType();
                    try (InputStream input = connection.getInputStream();
                         FileOutputStream output = new FileOutputStream(staging)) {
                        copy(input, output, MAX_DOWNLOAD);
                    }
                } finally {
                    connection.disconnect();
                }
                final File ready = staging;
                runOnUiThread(() -> offerDownload(ready, name, contentType));
            } catch (IOException e) {
                if (staging != null) staging.delete();
                runOnUiThread(() -> {
                    downloading = false;
                    toast("Download unavailable. Check your access and connection.");
                });
            }
        });
    }

    private void offerDownload(File file, String name, String contentType) {
        if (isFinishing() || isDestroyed()) {
            file.delete();
            return;
        }
        pendingDownload = file;
        String safeName = name.replaceAll("[^A-Za-z0-9._-]", "_");
        String mime = contentType == null ? "application/octet-stream" : contentType.split(";")[0].trim();
        if ("insight-attachment".equals(safeName)) {
            String extension = android.webkit.MimeTypeMap.getSingleton().getExtensionFromMimeType(mime);
            if (extension != null) safeName += "." + extension;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(mime)
            .putExtra(Intent.EXTRA_TITLE, safeName);
        try {
            startActivityForResult(intent, SAVE_FILE);
        } catch (RuntimeException e) {
            file.delete();
            pendingDownload = null;
            downloading = false;
            toast("No document picker is available.");
        }
    }

    private static HttpURLConnection connect(String url, Map<String, String> headers) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(12000);
        connection.setReadTimeout(15000);
        for (Map.Entry<String, String> header : headers.entrySet()) {
            connection.setRequestProperty(header.getKey(), header.getValue());
        }
        try {
            if (connection.getResponseCode() != 200) throw new IOException("Request failed");
            return connection;
        } catch (IOException error) {
            connection.disconnect();
            throw error;
        }
    }

    private static void copy(InputStream input, OutputStream output, long maximum) throws IOException {
        byte[] chunk = new byte[8192];
        long total = 0;
        for (int size; (size = input.read(chunk)) != -1;) {
            total += size;
            if (total > maximum) throw new IOException("File exceeds download limit");
            output.write(chunk, 0, size);
        }
    }

    private static byte[] readUrl(String url, Map<String, String> headers, int maximum) throws IOException {
        HttpURLConnection connection = connect(url, headers);
        try (InputStream input = connection.getInputStream();
             ByteArrayOutputStream result = new ByteArrayOutputStream()) {
            copy(input, result, maximum);
            return result.toByteArray();
        } finally {
            connection.disconnect();
        }
    }

    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request, result, data);
        if (request == PICK_FILE && pendingFiles != null) {
            ValueCallback<Uri[]> callback = pendingFiles;
            pendingFiles = null;
            callback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(result, data));
        }
        if (request == SAVE_FILE) {
            final File file = pendingDownload;
            pendingDownload = null;
            downloading = false;
            if (file == null) return;
            if (result != RESULT_OK || data == null || data.getData() == null) {
                file.delete();
                return;
            }
            final Uri destination = data.getData();
            worker.execute(() -> {
                try (InputStream input = new FileInputStream(file);
                     OutputStream output = getContentResolver().openOutputStream(destination)) {
                    if (output == null) throw new IOException("No output stream");
                    copy(input, output, MAX_DOWNLOAD);
                    runOnUiThread(() -> toast("Download saved."));
                } catch (IOException e) {
                    runOnUiThread(() -> toast("Could not save the file."));
                } finally {
                    file.delete();
                }
            });
        }
    }

    @Override public void onBackPressed() {
        if (web != null && web.getParent() != root) {
            installView(web);
        } else if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private void toast(String message) {
        if (!isFinishing() && !isDestroyed()) Toast.makeText(this, message, Toast.LENGTH_SHORT).show();
    }

    @Override protected void onPause() {
        super.onPause();
        CookieManager.getInstance().flush();
    }

    @Override protected void onDestroy() {
        if (pendingFiles != null) pendingFiles.onReceiveValue(null);
        if (pendingDownload != null) pendingDownload.delete();
        if (web != null) {
            root.removeView(web);
            web.destroy();
        }
        worker.shutdownNow();
        super.onDestroy();
    }
}
