#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Override these paths when the SDK packages are installed in a custom location.
sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
tools="${INSIGHT_ANDROID_BUILD_TOOLS:-$sdk/build-tools/35.0.0}"
platform="${INSIGHT_ANDROID_PLATFORM:-$sdk/platforms/android-35/android.jar}"
work="android/build"
out="${1:-$work/Insight.apk}"

: "${INSIGHT_ANDROID_KEYSTORE:?Set INSIGHT_ANDROID_KEYSTORE to your signing keystore}"
: "${INSIGHT_ANDROID_KEY_PASSWORD:?Set INSIGHT_ANDROID_KEY_PASSWORD}"
alias="${INSIGHT_ANDROID_KEY_ALIAS:-insight}"
[[ -f "$platform" && -x "$tools/aapt2" && -x "$tools/d8" && -x "$tools/apksigner" ]] || {
  echo "Install Android SDK Platform 35 and Android SDK Build Tools 35.0.0." >&2
  exit 1
}

mkdir -p "$work/generated" "$work/classes" "$work/dex" "$work/assets" "$(dirname "$out")"
rm -rf "$work/classes" "$work/generated" "$work/dex" "$work/assets/web"
mkdir -p "$work/generated" "$work/classes" "$work/dex"
python3 - "$work/assets/backend-origin.txt" <<'ORIGIN'
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit

raw = os.environ.get("INSIGHT_ANDROID_BACKEND_ORIGIN", "").strip()
if raw:
    origin = urlsplit(raw)
    if (origin.scheme != "https" or not origin.hostname or origin.username or origin.password
            or origin.path not in ("", "/") or origin.query or origin.fragment):
        sys.exit("INSIGHT_ANDROID_BACKEND_ORIGIN must be an HTTPS origin without a page path.")
    raw = "https://" + origin.netloc.lower()
Path(sys.argv[1]).write_text(raw, encoding="utf-8")
ORIGIN
VITE_INSIGHT_ANDROID=true npm run build -- --base /__insight_android__/ --outDir "$work/assets/web"

"$tools/aapt2" compile --dir android/src/main/res -o "$work/resources.zip"
"$tools/aapt2" link -I "$platform" --manifest android/src/main/AndroidManifest.xml \
  --java "$work/generated" -A "$work/assets" --version-code "${INSIGHT_ANDROID_VERSION_CODE:-1}" \
  --version-name "${INSIGHT_ANDROID_VERSION_NAME:-1.0.0}" \
  -o "$work/resources.apk" "$work/resources.zip"

find android/src/main/java "$work/generated" -name '*.java' > "$work/java-sources.txt"
javac --release 8 -classpath "$platform" -d "$work/classes" "@$work/java-sources.txt"
jar cf "$work/classes.jar" -C "$work/classes" .
"$tools/d8" --min-api 26 --lib "$platform" --output "$work/dex" "$work/classes.jar"
cp "$work/resources.apk" "$work/unsigned.apk"
jar uf "$work/unsigned.apk" -C "$work/dex" classes.dex
"$tools/zipalign" -f -P 16 4 "$work/unsigned.apk" "$work/aligned.apk"
"$tools/apksigner" sign --ks "$INSIGHT_ANDROID_KEYSTORE" --ks-key-alias "$alias" \
  --ks-pass env:INSIGHT_ANDROID_KEY_PASSWORD --key-pass env:INSIGHT_ANDROID_KEY_PASSWORD \
  --v4-signing-enabled false --out "$out" "$work/aligned.apk"
"$tools/apksigner" verify --verbose "$out"
"$tools/zipalign" -c -P 16 4 "$out"
