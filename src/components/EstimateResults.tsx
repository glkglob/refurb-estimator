import CurrencyDisplay from "@/components/CurrencyDisplay";
import InfoTooltip from "@/components/InfoTooltip";
import type { EstimateResult } from "@/lib/types";

type EstimateResultsProps = {
  result: EstimateResult;
};

export default function EstimateResults({ result }: EstimateResultsProps) {
  const summaryCards = [
    { label: "Low", total: result.totalLow, perM2: result.costPerM2.low },
    { label: "Typical", total: result.totalTypical, perM2: result.costPerM2.typical },
    { label: "High", total: result.totalHigh, perM2: result.costPerM2.high }
  ];

  function renderCategoryLabel(category: string) {
    if (category === "contingency") {
      return (
        <InfoTooltip
          term="Contingency"
          explanation="A buffer (typically 5–10%) for unexpected costs during the refurbishment."
        />
      );
    }

    if (category === "fees") {
      return (
        <InfoTooltip
          term="Fees"
          explanation="Professional fees including architect, surveyor, structural engineer, and building control."
        />
      );
    }

    return <span className="capitalize">{category}</span>;
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row">
        {summaryCards.map((card) => (
          <article key={card.label} className="flex-1 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-slate-600">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              <CurrencyDisplay amount={card.total} />
            </p>
            <p className="mt-2 text-sm text-slate-600">
              <span className="font-medium text-slate-700">Cost per m²:</span>{" "}
              <CurrencyDisplay amount={card.perM2} /> /m²
            </p>
          </article>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-slate-700">
            <tr>
              <th className="px-4 py-3 font-semibold">
                <span className="inline-flex items-center gap-2">
                  Category
                  <span className="inline-flex items-center gap-2 text-xs font-normal text-slate-600">
                    <InfoTooltip
                      term="Contingency"
                      explanation="A buffer (typically 5–10%) for unexpected costs during the refurbishment."
                    />
                    <InfoTooltip
                      term="Fees"
                      explanation="Professional fees including architect, surveyor, structural engineer, and building control."
                    />
                  </span>
                </span>
              </th>
              <th className="px-4 py-3 font-semibold">Low</th>
              <th className="px-4 py-3 font-semibold">Typical</th>
              <th className="px-4 py-3 font-semibold">High</th>
            </tr>
          </thead>
          <tbody>
            {result.categories.map((category, index) => (
              <tr key={category.category} className={index % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-3 font-medium text-slate-800">
                  {renderCategoryLabel(category.category)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <CurrencyDisplay amount={category.low} />
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <CurrencyDisplay amount={category.typical} />
                </td>
                <td className="px-4 py-3 text-slate-700">
                  <CurrencyDisplay amount={category.high} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
