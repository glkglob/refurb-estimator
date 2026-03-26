import { z } from "zod";
import {
  getRequestId,
  jsonError,
  jsonSuccess,
  logError
} from "@/lib/api-route";
import {
  CONTRACTOR_BUDGET_RANGE_OPTIONS,
  CONTRACTOR_PROJECT_TYPE_OPTIONS
} from "@/lib/contractorEnquiryOptions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateJsonRequest } from "@/lib/validate";

const enquirySchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255),
  postcode: z.string().trim().min(2).max(12),
  projectType: z.enum(CONTRACTOR_PROJECT_TYPE_OPTIONS),
  budgetRange: z.enum(CONTRACTOR_BUDGET_RANGE_OPTIONS),
  estimateTotal: z.coerce.number().finite().nonnegative().optional().nullable(),
  message: z.string().trim().max(2000).optional()
});

const ROUTE_TAG = "api/enquiries";

export async function POST(request: Request) {
  const requestId = getRequestId(request);

  try {
    const parsed = await validateJsonRequest(request, enquirySchema, {
      errorMessage: "Invalid enquiry payload"
    });

    if (!parsed.success) {
      return parsed.response;
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("contractor_enquiries").insert({
      user_id: user?.id ?? null,
      name: parsed.data.name,
      email: parsed.data.email.toLowerCase(),
      postcode: parsed.data.postcode.toUpperCase(),
      project_type: parsed.data.projectType,
      budget_range: parsed.data.budgetRange,
      estimate_total: parsed.data.estimateTotal ?? null,
      message: parsed.data.message && parsed.data.message.length > 0 ? parsed.data.message : null
    });

    if (error) {
      throw new Error(`Failed to submit enquiry: ${error.message}`);
    }

    return jsonSuccess({ success: true }, requestId, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit enquiry";
    logError(ROUTE_TAG, requestId, error);
    return jsonError(message, requestId, 500);
  }
}
