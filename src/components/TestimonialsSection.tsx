import type React from "react";

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

const WIN_RAISED: React.CSSProperties = {
  backgroundColor: "#d4d0c8",
  borderTop: "2px solid #ffffff",
  borderLeft: "2px solid #ffffff",
  borderRight: "2px solid #808080",
  borderBottom: "2px solid #808080",
};

export default function TestimonialsSection() {
  return (
    <section
      aria-labelledby="testimonials-heading"
      style={{ fontFamily: "Tahoma, Verdana, Arial, sans-serif", fontSize: "11px" }}
    >
      {/* Win2000 group box */}
      <div
        style={{
          border: "1px solid #808080",
          backgroundColor: "#d4d0c8",
          padding: "12px 8px 8px 8px",
          marginTop: "8px",
          position: "relative",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "-8px",
            left: "8px",
            backgroundColor: "#d4d0c8",
            padding: "0 4px",
            fontSize: "11px",
            fontWeight: "bold",
            color: "#000000",
          }}
        >
          <span id="testimonials-heading">What Early Users Say</span>
        </span>

        <div className="grid gap-2 md:grid-cols-3">
          {TESTIMONIALS.map((testimonial) => (
            <div
              key={testimonial.name}
              style={{ ...WIN_RAISED, padding: "8px" }}
            >
              <p style={{ color: "#cc8800", fontSize: "11px", fontWeight: "bold", marginBottom: "2px" }}>★★★★★</p>
              <p style={{ fontWeight: "bold", fontSize: "11px", color: "#000080", marginBottom: "4px" }}>
                {testimonial.projectType}
              </p>
              <blockquote style={{ fontSize: "11px", color: "#333333", lineHeight: "1.5", marginBottom: "4px" }}>
                &quot;{testimonial.quote}&quot;
              </blockquote>
              <p style={{ fontSize: "10px", color: "#666666" }}>
                {testimonial.name} &bull; {testimonial.location}
              </p>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "10px", color: "#666666", marginTop: "6px" }}>
          Early user testimonials. We&apos;re building our Trustpilot profile — leave a review!
        </p>
      </div>
    </section>
  );
}
