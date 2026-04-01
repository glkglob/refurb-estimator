import { Star } from "lucide-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";

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
    location: "London",
    projectType: "Homeowner",
    quote:
      "We were planning a wrap-around extension and had absolutely no idea where to start with our budget. The estimator gave us a solid baseline in seconds, and the room-by-room breakdown helped us understand exactly where our money was going before we even approached builders.",
  },
  {
    name: "David L.",
    location: "Manchester",
    projectType: "Landlord",
    quote:
      "I use this app to pressure-test different scopes for my buy-to-let properties. Being able to save different scenarios and compare the low versus high finish levels makes it incredibly easy to see which renovation strategy yields the best return on investment.",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="space-y-10" aria-labelledby="testimonials-heading">
      <div className="text-center">
        <h2 id="testimonials-heading" className="mb-3 font-serif text-3xl font-normal tracking-tight md:text-4xl">
          What early users say
        </h2>
        <p className="text-muted-foreground">
          Quick feedback from homeowners and investors using the estimator in beta.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((testimonial) => (
          <Card key={testimonial.name} className="flex flex-col">
            <CardHeader className="pb-4">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-accent text-accent" />
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              <p className="mb-4 text-sm font-medium">{testimonial.projectType}</p>
              <blockquote className="text-sm leading-relaxed text-muted-foreground">
                &ldquo;{testimonial.quote}&rdquo;
              </blockquote>
            </CardContent>
            <CardFooter className="pt-4 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{testimonial.name}</span>
              <span className="mx-2">·</span>
              <span>{testimonial.location}</span>
            </CardFooter>
          </Card>
        ))}
      </div>

      <p className="text-center text-sm text-muted-foreground">
        Early user testimonials. We&apos;re building our Trustpilot profile — leave a review!
      </p>
    </section>
  );
}
