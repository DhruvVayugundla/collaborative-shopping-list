/** Shared Tailwind class strings so controls look the same everywhere. */
export const input =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-60";

const btnBase =
  "inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60";

export const btnPrimary = `${btnBase} bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500`;
export const btnSecondary = `${btnBase} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400`;
export const btnDanger = `${btnBase} border border-red-200 bg-white text-red-700 hover:bg-red-50 focus-visible:ring-red-400`;
export const btnGhost = `${btnBase} px-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:ring-slate-400`;

export const card = "rounded-xl border border-slate-200 bg-white shadow-sm";
