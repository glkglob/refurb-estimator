"use client";

type InfoTooltipProps = {
  term: string;
  explanation: string;
};

export default function InfoTooltip({ term, explanation }: InfoTooltipProps) {
  return (
    <span className="group relative inline-flex items-center gap-1">
      <span>{term}</span>
      <button
        type="button"
        aria-label={`What is ${term}?`}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-slate-400 text-[10px] font-semibold leading-none text-slate-600 outline-none transition hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-slate-300"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden max-w-xs rounded bg-slate-800 px-3 py-2 text-xs text-white shadow-lg group-hover:block group-focus-within:block"
      >
        {explanation}
      </span>
    </span>
  );
}
