import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

type Testimonial = {
  name: string;
  location: string;
  projectType: string;
  quote: string;
};

const TESTIMONIALS: Testimonial[] = [
  {
    name: "Marcus J.",
    location: "Leeds",
    projectType: "Property Investor",
    quote:
      "As a property investor, the development appraisal tool is a game-changer. Being able to quickly run deal viability checks, model a BRRR strategy with realistic regional refurb costs, and instantly export the breakdown to PDF has saved me hours of spreadsheet work.",
  },
  {
    name: "Emma W.",
    location: "london",
    projectType: "Homeowner",
    quote:
      "We were planning a wrap-around extension and had absolutely no idea where to start with our budget. The estimator gave us a solid baseline in seconds, and the room-by-room breakdown helped us understand exactly where our money was going before we even approached builders.",
  },
  {
    name: "David L.",
    location: "Manchester",
    projectType: "Landlord",
    quote:
      "I use this app to pressure-test different scopes for my buy-to-let properties. Being able to save different scenarios and compare the 'Low' versus 'High' finish levels makes it incredibly easy to see which renovation strategy yields the best return on investment.",
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
