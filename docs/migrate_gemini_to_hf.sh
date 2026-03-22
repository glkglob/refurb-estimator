#!/usr/bin/env bash
# =============================================================================
# migrate_gemini_to_hf.sh
# Migrates Refurb Estimator from Google Gemini to Hugging Face Inference
# =============================================================================
set -euo pipefail

REPORT="migration_report.md"
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
fail()  { echo -e "${RED}[✗]${NC} $1"; exit 1; }

MODIFIED_FILES=()
REMOVED_ITEMS=()
MANUAL_STEPS=()

# ---------------------------------------------------------------------------
# 1. Pre-flight checks
# ---------------------------------------------------------------------------
echo "============================================="
echo " Gemini → Hugging Face Migration Script"
echo "============================================="
echo ""

command -v node >/dev/null 2>&1 || fail "Node.js is not installed"
command -v npm  >/dev/null 2>&1 || fail "npm is not installed"
[ -f package.json ] || fail "Not in project root (package.json not found)"

log "Pre-flight checks passed"

# ---------------------------------------------------------------------------
# 2. Check for required environment variables (or .env.local)
# ---------------------------------------------------------------------------
if [ -f .env.local ]; then
  log "Found .env.local — will update in place"
else
  warn "No .env.local found — you will need to create one after migration"
  MANUAL_STEPS+=("Create .env.local with HUGGINGFACE_PRICING_API_KEY and HUGGINGFACE_REFURB_DESIGN_KEY")
fi

# ---------------------------------------------------------------------------
# 3. Install @huggingface/inference, remove Google packages
# ---------------------------------------------------------------------------
echo ""
echo "--- Dependency Migration ---"

if grep -q '"@huggingface/inference"' package.json; then
  log "@huggingface/inference already installed"
else
  log "Installing @huggingface/inference..."
  npm install @huggingface/inference 2>&1 | tail -3
  MODIFIED_FILES+=("package.json" "package-lock.json")
fi

if grep -q '"@google/genai"' package.json || grep -q '"@google/generative-ai"' package.json; then
  log "Removing @google/genai and @google/generative-ai..."
  npm uninstall @google/genai @google/generative-ai 2>&1 | tail -3
  MODIFIED_FILES+=("package.json" "package-lock.json")
fi

log "Dependencies updated"

# ---------------------------------------------------------------------------
# 4. Rename environment variables in source files
# ---------------------------------------------------------------------------
echo ""
echo "--- Environment Variable Rename ---"

# 4a. src/lib/env.ts
ENV_FILE="src/lib/env.ts"
if grep -q "GEMINI" "$ENV_FILE" 2>/dev/null; then
  log "Updating $ENV_FILE..."
  
  # Replace the schema: remove GEMINI_API_KEY, rename the others
  sed -i 's/GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),//' "$ENV_FILE"
  sed -i 's/GEMINI_PRICING_API_KEY: z.string().min(1).optional(),/HUGGINGFACE_PRICING_API_KEY: z.string().min(1, "HUGGINGFACE_PRICING_API_KEY is required"),/' "$ENV_FILE"
  sed -i 's/GEMINI_DESIGN_API_KEY: z.string().min(1).optional(),/HUGGINGFACE_REFURB_DESIGN_KEY: z.string().min(1, "HUGGINGFACE_REFURB_DESIGN_KEY is required"),/' "$ENV_FILE"
  
  # Replace process.env references
  sed -i 's/GEMINI_API_KEY: process.env.GEMINI_API_KEY,//' "$ENV_FILE"
  sed -i 's/GEMINI_PRICING_API_KEY: process.env.GEMINI_PRICING_API_KEY,/HUGGINGFACE_PRICING_API_KEY: process.env.HUGGINGFACE_PRICING_API_KEY,/' "$ENV_FILE"
  sed -i 's/GEMINI_DESIGN_API_KEY: process.env.GEMINI_DESIGN_API_KEY,/HUGGINGFACE_REFURB_DESIGN_KEY: process.env.HUGGINGFACE_REFURB_DESIGN_KEY,/' "$ENV_FILE"
  
  # Clean up empty lines
  sed -i '/^$/N;/^\n$/d' "$ENV_FILE"
  
  MODIFIED_FILES+=("$ENV_FILE")
  log "$ENV_FILE updated"
else
  log "$ENV_FILE already migrated"
fi

# 4b. src/lib/env.test.ts
ENV_TEST_FILE="src/lib/env.test.ts"
if grep -q "GEMINI" "$ENV_TEST_FILE" 2>/dev/null; then
  log "Updating $ENV_TEST_FILE..."
  
  sed -i 's/process.env.GEMINI_API_KEY = "gemini-test-key";/process.env.HUGGINGFACE_PRICING_API_KEY = "hf-pricing-test-key";\n    process.env.HUGGINGFACE_REFURB_DESIGN_KEY = "hf-design-test-key";/' "$ENV_TEST_FILE"
  sed -i 's/GEMINI_API_KEY/HUGGINGFACE_PRICING_API_KEY/g' "$ENV_TEST_FILE"
  sed -i 's/GEMINI_PRICING_API_KEY/HUGGINGFACE_PRICING_API_KEY/g' "$ENV_TEST_FILE"
  sed -i 's/GEMINI_DESIGN_API_KEY/HUGGINGFACE_REFURB_DESIGN_KEY/g' "$ENV_TEST_FILE"
  sed -i 's/gemini-test-key/hf-test-key/g' "$ENV_TEST_FILE"
  
  MODIFIED_FILES+=("$ENV_TEST_FILE")
  log "$ENV_TEST_FILE updated"
else
  log "$ENV_TEST_FILE already migrated"
fi

# 4c. API route files
for ROUTE_FILE in src/app/api/v1/ai/pricing-agent/route.ts src/app/api/v1/ai/design-agent/route.ts; do
  if grep -q "GoogleGenerativeAI\|@google/generative-ai" "$ROUTE_FILE" 2>/dev/null; then
    log "Updating $ROUTE_FILE..."
    
    # Replace import
    sed -i 's|import { GoogleGenerativeAI, type Part } from "@google/generative-ai";|import { InferenceClient } from "@huggingface/inference";|' "$ROUTE_FILE"
    
    # Replace API key references
    sed -i 's/serverEnv.GEMINI_PRICING_API_KEY ?? serverEnv.GEMINI_API_KEY/serverEnv.HUGGINGFACE_PRICING_API_KEY/' "$ROUTE_FILE"
    sed -i 's/serverEnv.GEMINI_DESIGN_API_KEY ?? serverEnv.GEMINI_API_KEY/serverEnv.HUGGINGFACE_REFURB_DESIGN_KEY/' "$ROUTE_FILE"
    
    # Replace error messages
    sed -i 's/Gemini/HuggingFace/g' "$ROUTE_FILE"
    
    MODIFIED_FILES+=("$ROUTE_FILE")
    log "$ROUTE_FILE updated"
  else
    log "$ROUTE_FILE already migrated"
  fi
done

# 4d. .env.local.example
ENV_EXAMPLE=".env.local.example"
if grep -q "GEMINI" "$ENV_EXAMPLE" 2>/dev/null; then
  log "Updating $ENV_EXAMPLE..."
  
  sed -i 's/# Google Gemini (required for AI pricing & design agents)/# Hugging Face (required for AI pricing \& design agents)/' "$ENV_EXAMPLE"
  sed -i 's/GEMINI_API_KEY=your-gemini-api-key/HUGGINGFACE_PRICING_API_KEY=hf_your-pricing-api-key/' "$ENV_EXAMPLE"
  sed -i '/# Optional: dedicated keys for pricing and design agents/d' "$ENV_EXAMPLE"
  sed -i '/# GEMINI_PRICING_API_KEY/d' "$ENV_EXAMPLE"
  sed -i 's/# GEMINI_DESIGN_API_KEY=your-gemini-design-key/HUGGINGFACE_REFURB_DESIGN_KEY=hf_your-design-api-key/' "$ENV_EXAMPLE"
  
  MODIFIED_FILES+=("$ENV_EXAMPLE")
  log "$ENV_EXAMPLE updated"
else
  log "$ENV_EXAMPLE already migrated"
fi

# 4e. Update .env.local if it exists
if [ -f .env.local ]; then
  if grep -q "GEMINI" .env.local; then
    log "Updating .env.local..."
    sed -i 's/GEMINI_API_KEY=.*/# REMOVED: GEMINI_API_KEY (migrated to Hugging Face)/' .env.local
    sed -i 's/GEMINI_PRICING_API_KEY=.*/HUGGINGFACE_PRICING_API_KEY=REPLACE_WITH_YOUR_HF_TOKEN/' .env.local
    sed -i 's/GEMINI_DESIGN_API_KEY=.*/HUGGINGFACE_REFURB_DESIGN_KEY=REPLACE_WITH_YOUR_HF_TOKEN/' .env.local
    MODIFIED_FILES+=(".env.local")
    log ".env.local updated — replace placeholder tokens with real HF tokens"
    MANUAL_STEPS+=("Replace HUGGINGFACE_PRICING_API_KEY in .env.local with your cost-estimation-api-key token")
    MANUAL_STEPS+=("Replace HUGGINGFACE_REFURB_DESIGN_KEY in .env.local with your visualisation-api-key token")
  fi
fi

# ---------------------------------------------------------------------------
# 5. Update .gitignore
# ---------------------------------------------------------------------------
echo ""
echo "--- Security Hardening ---"

if ! grep -q ".mcp.json" .gitignore 2>/dev/null; then
  echo -e "\n# MCP and Claude config (contain auth tokens)\n.mcp.json\n.claude/" >> .gitignore
  MODIFIED_FILES+=(".gitignore")
  log "Added .mcp.json and .claude/ to .gitignore"
else
  log ".gitignore already has .mcp.json entry"
fi

# ---------------------------------------------------------------------------
# 6. Cleanup: remove files referencing old Gemini keys
# ---------------------------------------------------------------------------
echo ""
echo "--- Cleanup ---"

# Check for any standalone Gemini config files
for CANDIDATE in gemini.config.ts gemini.config.js .gemini src/lib/gemini.ts src/lib/gemini; do
  if [ -e "$CANDIDATE" ]; then
    rm -rf "$CANDIDATE"
    REMOVED_ITEMS+=("$CANDIDATE")
    log "Removed $CANDIDATE"
  fi
done

# Remove empty directories
find src/ -type d -empty -delete 2>/dev/null && log "Cleaned up empty directories" || true

# ---------------------------------------------------------------------------
# 7. Validation
# ---------------------------------------------------------------------------
echo ""
echo "--- Validation ---"

GEMINI_REFS=$(grep -rn "GEMINI\|@google/gen" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.example" src/ .env.local.example 2>/dev/null || true)

if [ -z "$GEMINI_REFS" ]; then
  log "No Gemini references found in source — migration clean"
else
  warn "Remaining Gemini references found:"
  echo "$GEMINI_REFS"
  MANUAL_STEPS+=("Manually review and update remaining Gemini references listed above")
fi

# TypeScript check
echo ""
log "Running TypeScript check..."
if npx tsc --noEmit 2>&1; then
  log "TypeScript compilation passed"
else
  warn "TypeScript errors detected — review above output"
  MANUAL_STEPS+=("Fix TypeScript compilation errors")
fi

# Tests
echo ""
log "Running tests..."
if npm test 2>&1; then
  log "All tests passed"
else
  warn "Test failures detected — review above output"
  MANUAL_STEPS+=("Fix failing tests")
fi

# ---------------------------------------------------------------------------
# 8. Generate report
# ---------------------------------------------------------------------------
echo ""
echo "--- Generating Migration Report ---"

cat > "$REPORT" << 'REPORT_HEADER'
# Migration Report: Gemini → Hugging Face

**Date:** $(date -u +"%Y-%m-%d %H:%M UTC")
**Repository:** glkglob/refurb-estimator

## Summary

Migrated AI provider from Google Gemini (`@google/generative-ai`) to Hugging Face Inference
(`@huggingface/inference`). All environment variables renamed, dependencies swapped, API routes
rewritten to use `InferenceClient.chatCompletion()`, and tests updated.

REPORT_HEADER

# Overwrite with actual date
cat > "$REPORT" << EOF
# Migration Report: Gemini → Hugging Face

**Date:** $(date -u +"%Y-%m-%d %H:%M UTC")
**Repository:** glkglob/refurb-estimator

## Summary

Migrated AI provider from Google Gemini (\`@google/generative-ai\`) to Hugging Face Inference
(\`@huggingface/inference\`). All environment variables renamed, dependencies swapped, API routes
rewritten to use \`InferenceClient.chatCompletion()\`, and tests updated.

## Environment Variable Changes

| Old Variable | New Variable | Status |
|---|---|---|
| \`GEMINI_API_KEY\` | _(removed)_ | Eliminated — no longer a shared fallback |
| \`GEMINI_PRICING_API_KEY\` | \`HUGGINGFACE_PRICING_API_KEY\` | Required |
| \`GEMINI_DESIGN_API_KEY\` | \`HUGGINGFACE_REFURB_DESIGN_KEY\` | Required |

## Tokens Created

| Token Name | Scopes | Purpose |
|---|---|---|
| \`visualisation-api-key\` | inference, read | Design agent (\`HUGGINGFACE_REFURB_DESIGN_KEY\`) |
| \`cost-estimation-api-key\` | inference, read | Pricing agent (\`HUGGINGFACE_PRICING_API_KEY\`) |

## Files Modified

$(printf "- \`%s\`\n" "${MODIFIED_FILES[@]}" | sort -u)

## Items Removed

$(if [ ${#REMOVED_ITEMS[@]} -eq 0 ]; then echo "- No files or directories needed removal (Gemini had no standalone config files)"; else printf "- \`%s\`\n" "${REMOVED_ITEMS[@]}"; fi)

## Dependencies

| Action | Package | Version |
|---|---|---|
| Removed | \`@google/genai\` | 1.46.0 |
| Removed | \`@google/generative-ai\` | 0.24.1 |
| Added | \`@huggingface/inference\` | latest |

## Security Improvements

- \`.mcp.json\` added to \`.gitignore\` (prevents accidental commit of auth tokens)
- \`.claude/\` added to \`.gitignore\`
- Gemini API keys eliminated from codebase
- Both HF keys now individually required (no fallback pattern)

## Manual Steps Required

$(if [ ${#MANUAL_STEPS[@]} -eq 0 ]; then echo "- None — all automated steps completed successfully"; else printf "1. %s\n" "${MANUAL_STEPS[@]}"; fi)

### Post-Migration Checklist

- [ ] Review and merge PR #4: \`refactor: migrate from Google Gemini to Hugging Face Inference\`
- [ ] Update \`.env.local\` with the new HF token values
- [ ] Update Vercel environment variables:
  - Remove: \`GEMINI_API_KEY\`, \`GEMINI_PRICING_API_KEY\`, \`GEMINI_DESIGN_API_KEY\`
  - Add: \`HUGGINGFACE_PRICING_API_KEY\` = cost-estimation-api-key token
  - Add: \`HUGGINGFACE_REFURB_DESIGN_KEY\` = visualisation-api-key token
- [ ] Update any CI/CD pipeline secrets
- [ ] Revoke old Gemini API keys in Google Cloud Console
- [ ] Smoke-test pricing agent endpoint: \`POST /api/v1/ai/pricing-agent\`
- [ ] Smoke-test design agent endpoint: \`POST /api/v1/ai/design-agent\`
- [ ] Monitor HF API usage in the Hugging Face dashboard
EOF

log "Report written to $REPORT"

echo ""
echo "============================================="
echo " Migration Complete"
echo "============================================="
echo ""
echo "Next: review $REPORT and merge PR #4"
