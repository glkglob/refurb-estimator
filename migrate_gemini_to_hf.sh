#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# migrate_gemini_to_hf.sh
# Idempotent migration helper for this repository:
# - removes Gemini packages if present
# - normalizes env examples to Hugging Face keys used by this codebase
# - checks for residual Gemini references
# - runs validation chain
# - writes migration_report.md
#
# Usage:
#   ./migrate_gemini_to_hf.sh
#   ./migrate_gemini_to_hf.sh --dry-run
# =============================================================================

REPORT="migration_report.md"
REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_ROOT"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[✓]${NC} $1"; }
warn() { echo -e "${YELLOW}[!]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

run_cmd() {
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] $*"
  else
    eval "$@"
  fi
}

sedi() {
  # macOS (BSD sed) vs GNU sed compatibility
  if [[ "$(uname -s)" == "Darwin" ]]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

MODIFIED_FILES=()
REMOVED_ITEMS=()
MANUAL_STEPS=()

echo "============================================="
echo " Gemini -> Hugging Face Migration Script"
echo "============================================="
echo ""

command -v node >/dev/null 2>&1 || fail "Node.js is not installed"
command -v npm >/dev/null 2>&1 || fail "npm is not installed"
command -v rg >/dev/null 2>&1 || fail "ripgrep (rg) is required"
[[ -f package.json ]] || fail "Not in project root (package.json not found)"

log "Pre-flight checks passed"

echo ""
echo "--- Dependency Migration ---"

if rg -q '"@google/genai"\s*:' package.json || rg -q '"@google/generative-ai"\s*:' package.json; then
  log "Removing @google/genai and @google/generative-ai..."
  run_cmd "npm uninstall @google/genai @google/generative-ai"
  MODIFIED_FILES+=("package.json" "package-lock.json")
else
  log "No Gemini SDK packages found in package.json"
fi

echo ""
echo "--- Environment Files ---"

ENV_EXAMPLE=".env.local.example"
if [[ -f "$ENV_EXAMPLE" ]]; then
  changed=false

  if rg -q "GEMINI_API_KEY|GEMINI_PRICING_API_KEY|GEMINI_DESIGN_API_KEY" "$ENV_EXAMPLE"; then
    log "Updating $ENV_EXAMPLE key names..."
    if [[ "$DRY_RUN" == "false" ]]; then
      # Remove old Gemini keys
      sedi '/^GEMINI_API_KEY=/d' "$ENV_EXAMPLE"
      sedi '/^GEMINI_PRICING_API_KEY=/d' "$ENV_EXAMPLE"
      sedi '/^GEMINI_DESIGN_API_KEY=/d' "$ENV_EXAMPLE"

      # Ensure HF keys used by the current codebase are present
      rg -q '^VISUALISATION_API_KEY=' "$ENV_EXAMPLE" || \
        echo 'VISUALISATION_API_KEY=your_hugging_face_visualisation_token_here' >> "$ENV_EXAMPLE"
      rg -q '^COST_ESTIMATION_API_KEY=' "$ENV_EXAMPLE" || \
        echo 'COST_ESTIMATION_API_KEY=your_hugging_face_cost_estimation_token_here' >> "$ENV_EXAMPLE"
      rg -q '^HUGGINGFACE_DESIGN_MODEL=' "$ENV_EXAMPLE" || \
        echo 'HUGGINGFACE_DESIGN_MODEL=mistralai/Mistral-7B-Instruct-v0.3' >> "$ENV_EXAMPLE"
      rg -q '^HUGGINGFACE_PRICING_MODEL=' "$ENV_EXAMPLE" || \
        echo 'HUGGINGFACE_PRICING_MODEL=mistralai/Mistral-7B-Instruct-v0.3' >> "$ENV_EXAMPLE"
    else
      echo "[dry-run] normalize $ENV_EXAMPLE to VISUALISATION_API_KEY/COST_ESTIMATION_API_KEY"
    fi
    changed=true
  fi

  if [[ "$changed" == "true" ]]; then
    MODIFIED_FILES+=("$ENV_EXAMPLE")
    log "$ENV_EXAMPLE updated"
  else
    log "$ENV_EXAMPLE already aligned"
  fi
else
  warn "No $ENV_EXAMPLE found"
  MANUAL_STEPS+=("Create .env.local.example with VISUALISATION_API_KEY and COST_ESTIMATION_API_KEY")
fi

if [[ -f .env.local ]]; then
  if rg -q '^GEMINI_(API_KEY|PRICING_API_KEY|DESIGN_API_KEY)=' .env.local; then
    log "Found Gemini keys in .env.local; replacing with placeholders"
    if [[ "$DRY_RUN" == "false" ]]; then
      sedi 's/^GEMINI_API_KEY=.*/# REMOVED: GEMINI_API_KEY/' .env.local
      sedi 's/^GEMINI_PRICING_API_KEY=.*/COST_ESTIMATION_API_KEY=REPLACE_WITH_YOUR_HF_TOKEN/' .env.local
      sedi 's/^GEMINI_DESIGN_API_KEY=.*/VISUALISATION_API_KEY=REPLACE_WITH_YOUR_HF_TOKEN/' .env.local
    else
      echo "[dry-run] replace GEMINI_* keys in .env.local with HF placeholders"
    fi
    MODIFIED_FILES+=(".env.local")
    MANUAL_STEPS+=("Replace COST_ESTIMATION_API_KEY in .env.local with the real Hugging Face token")
    MANUAL_STEPS+=("Replace VISUALISATION_API_KEY in .env.local with the real Hugging Face token")
  else
    log ".env.local has no Gemini keys"
  fi
else
  warn "No .env.local found"
  MANUAL_STEPS+=("Create .env.local and define VISUALISATION_API_KEY/COST_ESTIMATION_API_KEY")
fi

echo ""
echo "--- Security Hardening ---"

if [[ -f .gitignore ]]; then
  gitignore_changed=false
  if ! rg -q '(^|/)\.mcp\.json$' .gitignore; then
    if [[ "$DRY_RUN" == "false" ]]; then
      {
        echo ""
        echo "# Local MCP/assistant config"
        echo ".mcp.json"
      } >> .gitignore
    else
      echo "[dry-run] append .mcp.json to .gitignore"
    fi
    gitignore_changed=true
  fi
  if ! rg -q '(^|/)\.claude/?$' .gitignore; then
    if [[ "$DRY_RUN" == "false" ]]; then
      echo ".claude/" >> .gitignore
    else
      echo "[dry-run] append .claude/ to .gitignore"
    fi
    gitignore_changed=true
  fi
  if [[ "$gitignore_changed" == "true" ]]; then
    MODIFIED_FILES+=(".gitignore")
    log ".gitignore updated"
  else
    log ".gitignore already includes MCP/Claude entries"
  fi
else
  warn ".gitignore not found"
fi

echo ""
echo "--- Cleanup ---"

for candidate in gemini.config.ts gemini.config.js .gemini src/lib/gemini.ts src/lib/gemini; do
  if [[ -e "$candidate" ]]; then
    log "Removing $candidate"
    run_cmd "rm -rf \"$candidate\""
    REMOVED_ITEMS+=("$candidate")
  fi
done

echo ""
echo "--- Reference Scan ---"

GEMINI_REFS="$(rg -n -S \
  -g '!node_modules' \
  -g '!.git' \
  'GEMINI|gemini|@google/genai|@google/generative-ai|GoogleGenerativeAI' \
  src .env.local.example package.json package-lock.json 2>/dev/null || true)"

if [[ -z "$GEMINI_REFS" ]]; then
  log "No Gemini references found in source/config files"
else
  warn "Remaining Gemini references found:"
  echo "$GEMINI_REFS"
  MANUAL_STEPS+=("Review and remove remaining Gemini references listed above")
fi

echo ""
echo "--- Validation ---"

run_validation_step() {
  local label="$1"
  local cmd="$2"
  echo ""
  log "Running $label..."
  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[dry-run] $cmd"
    return 0
  fi
  if eval "$cmd"; then
    log "$label passed"
  else
    warn "$label failed"
    MANUAL_STEPS+=("Fix $label failures")
  fi
}

run_validation_step "TypeScript" "npx tsc --noEmit"
run_validation_step "ESLint" "npx eslint . --fix"
run_validation_step "Jest changedSince main" "npx jest --changedSince=main"
run_validation_step "Build" "npm run build"

echo ""
echo "--- Generating Report ---"

if [[ "$DRY_RUN" == "false" ]]; then
  cat > "$REPORT" << EOF
# Migration Report: Gemini -> Hugging Face

**Date:** $(date -u +"%Y-%m-%d %H:%M UTC")
**Repository:** uk-property-refurb-estimator
**Mode:** apply

## Summary

Completed Gemini-to-Hugging-Face migration checks and cleanup for this repository's current
provider setup. This codebase uses:

- \`VISUALISATION_API_KEY\` (design agent)
- \`COST_ESTIMATION_API_KEY\` (pricing agent)
- optional fallback keys (\`HUGGINGFACE_REFURB_DESIGN_KEY\`, \`HUGGINGFACE_REFURB_PRICING_KEY\`)

## Files Modified

$(if [[ ${#MODIFIED_FILES[@]} -eq 0 ]]; then echo "- None"; else printf -- "- \`%s\`\n" "${MODIFIED_FILES[@]}" | sort -u; fi)

## Items Removed

$(if [[ ${#REMOVED_ITEMS[@]} -eq 0 ]]; then echo "- None"; else printf -- "- \`%s\`\n" "${REMOVED_ITEMS[@]}"; fi)

## Manual Steps Required

$(if [[ ${#MANUAL_STEPS[@]} -eq 0 ]]; then echo "- None"; else printf -- "1. %s\n" "${MANUAL_STEPS[@]}"; fi)
EOF
  log "Report written to $REPORT"
else
  log "Dry run complete; report not written"
fi

echo ""
echo "============================================="
echo " Migration Complete"
echo "============================================="
echo ""
if [[ "$DRY_RUN" == "true" ]]; then
  echo "Run without --dry-run to apply changes."
else
  echo "Next: review $REPORT and commit changes."
fi
