import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Testimonial = {
  name: string;
  location: string;
  projectType: string;
  quote: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Sarah T.",
    location: "Manchester",
    projectType: "Victorian terrace refurb",
    quote:
      "The estimate was within 5% of contractor quotes and helped me set a realistic budget before starting.",
  },
  {
    name: "James R.",
    location: "Bristol",
    projectType: "Kitchen and bathroom upgrade",
    quote:
      "Regional pricing and category breakdowns made it easy to compare options and avoid overspending early.",
  },
  {
    name: "Priya M.",
    location: "Birmingham",
    projectType: "Buy-to-let refresh",
    quote:
      "I used it to pressure-test two scopes in minutes. Clear outputs and genuinely useful as a first pass.",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="space-y-4" aria-labelledby="testimonials-heading">
      <div className="space-y-1">
        <h2 id="testimonials-heading" className="text-2xl font-semibold tracking-tight">
          What early users say
        </h2>
        <p className="text-sm text-muted-foreground">
          Quick feedback from homeowners and investors using the estimator in beta.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial) => (
          <Card key={testimonial.name} className="border-border/70 bg-card/80">
            <CardHeader className="space-y-2 pb-2">
              <p className="text-sm font-medium tracking-wide text-amber-400">★★★★★</p>
              <CardTitle className="text-base">{testimonial.projectType}</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <blockquote className="text-sm leading-relaxed text-muted-foreground">
                “{testimonial.quote}”
              </blockquote>
            </CardContent>
            <CardFooter className="text-xs text-muted-foreground">
              {testimonial.name} • {testimonial.location}
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Early user testimonials. We’re building our Trustpilot profile — leave a review!
      </p>
    </section>
  );
}
