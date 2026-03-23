import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Refurb Estimator",
  description: "Terms of service for Refurb Estimator."
};

export default function TermsOfServicePage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Terms of Service</h1>
      <p className="text-sm text-zinc-300">Last updated: March 22, 2026</p>
      <section className="space-y-3 text-zinc-200">
        <p>
          Refurb Estimator provides planning and pricing guidance. Estimates are informational and
          do not constitute a contractual quote.
        </p>
        <p>
          You are responsible for validating outputs and obtaining professional advice before
          undertaking works.
        </p>
        <p>
          By using the app, you agree not to misuse the service, attempt unauthorized access, or
          upload content you do not have rights to share.
        </p>
      </section>
    </main>
  );
}
