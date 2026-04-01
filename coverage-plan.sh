#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$HOME/workspace/uk-property-refurb-estimator"

echo "==> Moving to project"
cd "$PROJECT_DIR"

echo "==> Confirming location"
pwd

echo "==> Checking core tools"
command -v pnpm >/dev/null 2>&1 || { echo "pnpm not found"; exit 1; }
command -v open >/dev/null 2>&1 || { echo "open command not found"; exit 1; }

echo "==> Running TypeScript check"
pnpm tsc --noEmit

echo "==> Running lint"
pnpm lint

echo "==> Running full coverage"
pnpm test --coverage

echo "==> Opening HTML coverage report"
if [ -f "coverage/lcov-report/index.html" ]; then
  open "coverage/lcov-report/index.html"
else
  echo "Coverage report not found at coverage/lcov-report/index.html"
fi

echo
echo "==> Priority source inventory"
find src \
  \( -path "src/lib/supabase*" \
  -o -path "src/app/auth/login*" \
  -o -path "src/app/auth/signup*" \
  -o -path "src/app/auth/forgot-password*" \
  -o -path "src/app/scenarios*" \
  -o -path "src/app/new-build*" \
  -o -path "src/app/api/v1/assistant/chat*" \
  -o -path "src/lib/telemetry*" \
  -o -path "src/app/tradespeople*" \
  -o -path "src/components*" \
  -o -path "src/components/ui*" \) \
  -type f | sort

echo
echo "==> Related test inventory"
find src test \
  \( -iname "*supabase*.test.*" -o -iname "*supabase*.spec.*" \
  -o -iname "*login*.test.*" -o -iname "*login*.spec.*" \
  -o -iname "*signup*.test.*" -o -iname "*signup*.spec.*" \
  -o -iname "*forgot*.test.*" -o -iname "*forgot*.spec.*" \
  -o -iname "*scenario*.test.*" -o -iname "*scenario*.spec.*" \
  -o -iname "*new-build*.test.*" -o -iname "*new-build*.spec.*" \
  -o -iname "*assistant*.test.*" -o -iname "*assistant*.spec.*" \
  -o -iname "*chat*.test.*" -o -iname "*chat*.spec.*" \
  -o -iname "*telemetry*.test.*" -o -iname "*telemetry*.spec.*" \
  -o -iname "*tradespeople*.test.*" -o -iname "*tradespeople*.spec.*" \) \
  2>/dev/null | sort || true

echo
echo "==> Coverage improvement priority order"
cat <<'EOF'
1. src/lib/supabase
2. src/app/auth/login
3. src/app/auth/signup
4. src/app/auth/forgot-password
5. src/app/scenarios
6. src/app/new-build
7. src/app/api/v1/assistant/chat
8. src/lib/telemetry
9. src/app/tradespeople/[userId]
10. src/components
11. src/components/ui
EOF

echo
echo "==> Focused test command template"
cat <<'EOF'
pnpm test -- --runInBand path/to/test-file.test.ts
pnpm test -- --runInBand path/to/test-file.test.tsx
EOF

echo
echo "==> Full validation command template"
cat <<'EOF'
pnpm tsc --noEmit
pnpm lint
pnpm test --coverage
EOF

echo
echo "==> Done"
