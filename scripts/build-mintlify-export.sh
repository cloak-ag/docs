#!/usr/bin/env bash
set -euo pipefail

rm -rf export .mintlify-export.zip
npx --yes mint export --output .mintlify-export.zip --disable-openapi
mkdir -p export
unzip -q .mintlify-export.zip -d export
rm -f .mintlify-export.zip
