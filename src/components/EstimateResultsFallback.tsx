export default function EstimateResultsFallback() {
  return (
    <section aria-label="Loading estimate results" className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-28 animate-pulse rounded-lg border border-border bg-muted/40" />
        ))}
      </div>
      <div className="h-72 animate-pulse rounded-lg border border-border bg-muted/40" />
      <div className="h-80 animate-pulse rounded-lg border border-border bg-muted/40" />
    </section>
  );
}
