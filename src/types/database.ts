export type PaymentStatus =
  | "requires_payment_method"
  | "requires_confirmation"
  | "requires_action"
  | "processing"
  | "requires_capture"
  | "canceled"
  | "succeeded";

export type PaymentIntentRow = {
  id: string;
  stripe_payment_intent_id: string;
  stripe_customer_id: string | null;
  stripe_checkout_session_id: string | null;
  user_id: string | null;
  amount: number;
  currency: string;
  status: PaymentStatus;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
