# Migration Report: Gemini -> Hugging Face

**Date:** 2026-03-22 14:20 UTC
**Repository:** uk-property-refurb-estimator
**Mode:** apply

## Summary

Completed Gemini-to-Hugging-Face migration checks and cleanup for this repository's current
provider setup. This codebase uses:

- `VISUALISATION_API_KEY` (design agent)
- `COST_ESTIMATION_API_KEY` (pricing agent)
- optional fallback keys (`HUGGINGFACE_REFURB_DESIGN_KEY`, `HUGGINGFACE_REFURB_PRICING_KEY`)

## Files Modified

- `.env.local`
- `.gitignore`

## Items Removed

- None

## Manual Steps Required

1. Replace COST_ESTIMATION_API_KEY in .env.local with the real Hugging Face token
1. Replace VISUALISATION_API_KEY in .env.local with the real Hugging Face token
