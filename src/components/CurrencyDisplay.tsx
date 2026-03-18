type CurrencyDisplayProps = {
  amount: number;
};

const gbpFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
  maximumFractionDigits: 0
});

export default function CurrencyDisplay({ amount }: CurrencyDisplayProps) {
  return <>{gbpFormatter.format(amount)}</>;
}
