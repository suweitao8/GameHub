#!/bin/bash

set -eu

defaultLanguage="en-US"

# Supported languages (key:locale pairs) - Bash 3.2 compatible for macOS
languages=(
    ar:ar
    ca:ca-ES
    cs:cs-CZ
    de:de-DE
    el:el-GR
    en:en-US
    eo:eo
    es:es-ES
    eu:eu-ES
    fa:fa-IR
    fi:fi-FI
    fr:fr-FR
    gd:gd
    gl:gl-ES
    hr:hr
    hu:hu-HU
    is:is
    it:it-IT
    ja:ja-JP
    ka:ka
    kab:kab
    ko:ko-KR
    nb:nb-NO
    nl:nl-NL
    nn:nn
    oc:oc
    pl:pl-PL
    pt-PT:pt-PT
    pt:pt-BR
    ro:ro
    ru:ru-RU
    sk:sk-SK
    sq:sq
    sv:sv-SE
    th:th-TH
    tok:tok
    tr:tr-TR
    uk:uk-UA
    vi:vi-VN
    zh-Hans:zh-Hans-CN
    zh-Hant:zh-Hant-TW
)

# PeerTube server serves static files from client/dist/browser and HTML from
# client/dist/browser/<locale>/index.html (see server/core/controllers/client.ts
# and server/core/lib/html/shared/page-html.ts). Angular's application builder
# nests an extra "browser/" directory under the output path — flatten it here.

flatten_angular_browser_dir () {
  local locale_dir="$1"

  if [ -d "$locale_dir/browser" ]; then
    # Move nested browser/* up into the locale folder.
    shopt -s dotglob nullglob
    for entry in "$locale_dir/browser"/*; do
      base="$(basename "$entry")"
      if [ -e "$locale_dir/$base" ]; then
        rm -rf "$locale_dir/$base"
      fi
      mv "$entry" "$locale_dir/$base"
    done
    shopt -u dotglob nullglob
    rmdir "$locale_dir/browser" 2>/dev/null || rm -rf "$locale_dir/browser"
  fi
}

rm -rf ./client/dist

npm run build:embed

cd client

# Don't build other languages if --light arg is provided
if [ -z ${1+x} ] || ([ "$1" != "--light" ] && [ "$1" != "--analyze-bundle" ]); then
    additionalParams=""
    if [ -z ${1+x} ] || [ "$1" != "--source-map" ]; then
        additionalParams="--source-map=false"
    fi

    NODE_OPTIONS=--max_old_space_size=8192 node_modules/.bin/ng build --configuration production --output-path "dist/build" $additionalParams

    mkdir -p dist/browser

    for entry in "${languages[@]}"; do
        key="${entry%%:*}"
        lang="${entry#*:}"

        # Angular 22: dist/build/browser/<key> (locale key) or dist/build/browser for single
        if [ -d "dist/build/browser/$key" ]; then
          mv "dist/build/browser/$key" "dist/browser/$lang"
        elif [ -d "dist/build/$key" ]; then
          mv "dist/build/$key" "dist/browser/$lang"
        else
          echo "Missing build output for locale key '$key'" >&2
          exit 1
        fi

        flatten_angular_browser_dir "dist/browser/$lang"

        if [ "$lang" != "en-US" ]; then
            # Do not duplicate assets under every locale
            rm -rf "./dist/browser/$lang/assets"
        fi
    done

    # Hoist default-locale assets so /client/assets maps to dist/browser/assets
    if [ -d "./dist/browser/$defaultLanguage/assets" ]; then
      mv "./dist/browser/$defaultLanguage/assets" "./dist/browser/assets"
    fi

    rm -rf "dist/build"
else
    additionalParams=""
    if [ ! -z ${1+x} ] && [ "$1" == "--analyze-bundle" ]; then
        additionalParams="--named-chunks=true --output-hashing=none"

        # For Vite
        export ANALYZE_BUNDLE=true
    fi

    # --localize=false would inherit baseHref "/" from angular.json; force /client/<locale>/
    # so SPA scripts resolve under express.static('/client' -> dist/browser).
    NODE_OPTIONS=--max_old_space_size=8192 node_modules/.bin/ng build --localize=false \
                                                              --base-href "/client/$defaultLanguage/" \
                                                              --output-path "dist/browser/$defaultLanguage" \
                                                              --configuration production --stats-json $additionalParams

    flatten_angular_browser_dir "dist/browser/$defaultLanguage"

    if [ -d "./dist/browser/$defaultLanguage/assets" ]; then
      mv "./dist/browser/$defaultLanguage/assets" "./dist/browser/assets"
    fi
fi

# Copy runtime locales (i18n JSON for server translations endpoint)
cp -r "./src/locale" "./dist/locale"
