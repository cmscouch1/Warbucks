# Head Unit Respring

Single-purpose Android app for car head units: one large **Respring** toggle that restarts System UI (and falls back to a soft framework restart) so a frozen head-unit screen recovers.

## What it does

Flipping the toggle ON tries these methods in order (common on aftermarket Android head units):

1. `am force-stop com.android.systemui`
2. `killall com.android.systemui` / `killall systemui`
3. `pkill -f com.android.systemui`
4. Root: `su` → force-stop System UI
5. Root: `su` → killall / pkill System UI
6. Root: `su` → `setprop ctl.restart zygote` (soft restart)
7. `am restart`

If every method fails (typical on locked, non-root phones), the toggle flips back OFF and shows the error.

> Most head units need **root** or a **system/privileged install** for respring to succeed. Sideloading alone is often not enough on locked firmwares.

## Install on your head unit

### Option A — normal sideload (works if the unit is rooted / permissive)

1. Copy `app/build/outputs/apk/debug/app-debug.apk` to USB, or use ADB.
2. Enable **Unknown sources** on the head unit.
3. Install the APK and open **Head Unit Respring**.
4. Flip **Respring**. System UI should restart.

ADB:

```bash
adb connect <HEAD_UNIT_IP>:5555
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n com.warbucks.restart/.MainActivity
```

Or:

```bash
./scripts/install-to-device.sh
```

### Option B — system/privileged install (if Option A cannot respring)

```bash
adb root
adb remount
adb shell mkdir -p /system/priv-app/HeadUnitRespring
adb push app/build/outputs/apk/debug/app-debug.apk /system/priv-app/HeadUnitRespring/HeadUnitRespring.apk
adb shell chmod 644 /system/priv-app/HeadUnitRespring/HeadUnitRespring.apk
adb reboot
```

## Build & test

```bash
export ANDROID_HOME=$HOME/android-sdk
./gradlew assembleDebug testDebugUnitTest
```

Debug APK:

`app/build/outputs/apk/debug/app-debug.apk`

## Requirements

- Android 5.0+ (API 21)
- Landscape-friendly UI for HU screens
- Root **or** system/privileged install for reliable respring on most units
