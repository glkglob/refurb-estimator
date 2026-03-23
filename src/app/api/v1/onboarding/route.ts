import { z } from "zod";
import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logApiError,
  withRequestIdHeader
} from "@/lib/api-route";
import { requireRole } from "@/lib/rbac";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AuthError, handleAuthError } from "@/lib/supabase/auth-helpers";
import { validateJsonRequest } from "@/lib/validate";

const tradeTypeSchema = z.enum([
  "plumber",
  "electrician",
  "builder",
  "decorator",
  "general"
]);

const onboardingSchema = z.object({
  businessName: z.string().trim().min(1).max(200),
  tradeType: tradeTypeSchema,
  yearsExperience: z.coerce.number().int().min(0).max(70),
  servicePostcode: z.string().trim().min(2).max(10),
  serviceRadiusMiles: z.coerce.number().int().refine((value) => [5, 10, 25, 50].includes(value), {
    message: "Service radius must be one of: 5, 10, 25, 50"
  }),
  profilePhotoUrl: z.string().url(),
  bio: z.string().trim().min(10).max(2000)
});

const tradeTypeLabelMap: Record<z.infer<typeof tradeTypeSchema>, string> = {
  plumber: "Plumber",
  electrician: "Electrician",
  builder: "Builder",
  decorator: "Decorator",
  general: "General"
};

const ROUTE_TAG = "api/v1/onboarding";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const user = await requireRole("TRADESPERSON");
    const parsed = await validateJsonRequest(request, onboardingSchema, {
      errorMessage: "Invalid onboarding payload"
    });

    if (!parsed.success) {
      return withRequestIdHeader(parsed.response, requestId);
    }

    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from("profiles")
      .update({
        business_name: parsed.data.businessName,
        trade_specialty: tradeTypeLabelMap[parsed.data.tradeType],
        years_experience: parsed.data.yearsExperience,
        location_postcode: parsed.data.servicePostcode.toUpperCase(),
        service_radius_miles: parsed.data.serviceRadiusMiles,
        avatar_url: parsed.data.profilePhotoUrl,
        bio: parsed.data.bio,
        onboarding_complete: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id);

    if (error) {
      throw new Error(`Failed to complete onboarding: ${error.message}`);
    }

    return jsonSuccess({ success: true }, { status: 200, requestId });
  } catch (error) {
    if (error instanceof AuthError) {
      return withRequestIdHeader(handleAuthError(error), requestId);
    }

    const message = error instanceof Error ? error.message : "Failed to complete onboarding";
    logApiError({
      route: ROUTE_TAG,
      requestId,
      error,
      code: "ONBOARDING_POST_FAILED"
    });
    return jsonError({
      status: 500,
      error: message,
      requestId,
      code: "ONBOARDING_POST_FAILED"
    });
  }
}
