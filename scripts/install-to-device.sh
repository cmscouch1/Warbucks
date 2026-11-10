#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APK="${ROOT_DIR}/app/build/outputs/apk/debug/app-debug.apk"

if [[ ! -f "$APK" ]]; then
  echo "APK not found. Building debug APK..."
  (
    cd "$ROOT_DIR"
    ./gradlew assembleDebug
  )
fi

if ! command -v adb >/dev/null 2>&1; then
  echo "adb not found. Install Android platform-tools and retry."
  exit 1
fi

echo "Waiting for a device (USB or adb connect <ip>:5555)..."
adb wait-for-device
adb install -r "$APK"
adb shell am start -n com.warbucks.restart/.MainActivity
echo "Installed and launched Head Unit Restart."
