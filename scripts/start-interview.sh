#!/usr/bin/env bash
set -euo pipefail
export PATH="$HOME/.local/bin:$PATH"
cd "$(dirname "${BASH_SOURCE[0]}")/.."
if ! codex login status; then
  printf '\nCodex 계정 로그인이 필요합니다. 이어서 브라우저 로그인 안내가 나옵니다.\n'
  codex login
fi
exec codex
