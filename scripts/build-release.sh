#!/usr/bin/env bash
# Signed release build. TERCUME_SIGNING_PROPS must point at a properties file
# (storeFile, storePassword, keyAlias, keyPassword) kept OUTSIDE the repo.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${TERCUME_SIGNING_PROPS:?set TERCUME_SIGNING_PROPS}"
export JAVA_HOME="${JAVA_HOME:-/home/box/sdk/jdk-21.0.13+9}"
export ANDROID_HOME="${ANDROID_HOME:-/home/box/sdk/android}"
cd "$ROOT/android"
./gradlew --no-daemon assembleRelease bundleRelease -PversionCode="${VERSION_CODE:-3}" -PversionName="${VERSION_NAME:-1.0.2}"
ls -la app/build/outputs/apk/release/ app/build/outputs/bundle/release/
