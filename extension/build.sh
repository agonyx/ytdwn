#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"
EXT_DIR=$(pwd)
BUILD_DIR="$EXT_DIR/dist"

rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR"

SHARED_FILES=(
  "popup.html"
  "popup.css"
  "popup.js"
  "content.js"
  "content.css"
  "background.js"
  "icons/icon16.png"
  "icons/icon32.png"
  "icons/icon48.png"
  "icons/icon128.png"
)

build_variant() {
  local name="$1"
  local manifest_src="$2"
  local out_dir="$BUILD_DIR/$name"
  mkdir -p "$out_dir/icons"
  cp "$manifest_src" "$out_dir/manifest.json"
  for f in "${SHARED_FILES[@]}"; do
    cp "$f" "$out_dir/$f"
  done
  cd "$BUILD_DIR"
  if command -v zip &> /dev/null; then
    zip -r "$name.zip" "$name" > /dev/null
  elif command -v 7z &> /dev/null; then
    7z a -tzip "$name.zip" "$name" > /dev/null
  else
    echo "  (skipping zip, no zip/7z found)"
  fi
  cd "$EXT_DIR"
  echo "  -> dist/$name/ (unpacked)"
  echo "  -> dist/$name.zip"
}

echo "Building Chrome..."
build_variant "ytdwn-chrome" "manifest.json"

echo "Building Firefox..."
build_variant "ytdwn-firefox" "manifest.firefox.json"

echo "Building Safari..."
build_variant "ytdwn-safari" "manifest.safari.json"

echo "Done!"
