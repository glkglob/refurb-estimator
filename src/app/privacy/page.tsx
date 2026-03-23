import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Refurb Estimator",
  description: "Privacy policy for Refurb Estimator."
};

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-semibold tracking-tight text-white">Privacy Policy</h1>
      <p className="text-sm text-zinc-300">Last updated: March 22, 2026</p>
      <section className="space-y-3 text-zinc-200">
        <p>
          Refurb Estimator collects only the data required to provide property refurbishment
          estimates, account features, and file uploads.
        </p>
        <p>
          We process account details and submitted images to deliver app functionality. We do not
          sell personal information.
        </p>
        <p>
          You can request data access or deletion by contacting support through the in-app contact
          channel.
        </p>
      </section>
    </main>
  );
}
