import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatusMessageVariant = "error" | "info";

type StatusMessageCardProps = {
  message: string;
  variant?: StatusMessageVariant;
  className?: string;
};

export default function StatusMessageCard({
  message,
  variant = "info",
  className
}: StatusMessageCardProps) {
  return (
    <Card
      className={cn(
        variant === "error" ? "border-destructive/40" : "border-primary/40",
        className
      )}
    >
      <CardContent
        className={cn(
          "pt-4 text-sm",
          variant === "error" ? "text-destructive" : "text-primary"
        )}
      >
        {message}
      </CardContent>
    </Card>
  );
}
