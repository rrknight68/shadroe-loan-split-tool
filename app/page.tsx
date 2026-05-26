"use client";

import { useMemo, useState } from "react";

/* ------------------------------------------------------------------ */
/* Brand tokens                                                        */
/* ------------------------------------------------------------------ */
const C = {
  navy: "#0D2B4E",
  gold: "#C89A3A",
  cream: "#F9F7F3",
  blue: "#185FA5", // Loan A — West
  green: "#0F6E56", // Loan B — North
  ink: "#1c2733",
  line: "#e4ddcf",
};

/* ------------------------------------------------------------------ */
/* Unit model — single source of truth, everything computes from here  */
/* ------------------------------------------------------------------ */
const FLOOR_RATE: Record<number, number> = {
  1: 950,
  2: 975,
  3: 1100,
  4: 1150,
  5: 1200,
  6: 1250,
  7: 1350,
};

type UnitType = "B1" | "C1";
const SPEC: Record<UnitType, { brba: string; sf: number }> = {
  B1: { brba: "3BR / 3BA", sf: 1350 },
  C1: { brba: "2BR / 2BA", sf: 1125 },
};

interface Unit {
  floor: number;
  id: string;
  type: UnitType;
  brba: string;
  sf: number;
  rate: number;
  value: number;
}

function mk(floor: number, id: string, type: UnitType): Unit {
  const { brba, sf } = SPEC[type];
  const rate = FLOOR_RATE[floor];
  return { floor, id, type, brba, sf, rate, value: sf * rate };
}

// Loan A — West facing: 7 floors × (B1, B1, C1) = 21 units
const LOAN_A_UNITS: Unit[] = [];
for (let f = 1; f <= 7; f++) {
  LOAN_A_UNITS.push(mk(f, `W${f}A`, "B1"));
  LOAN_A_UNITS.push(mk(f, `W${f}B`, "B1"));
  LOAN_A_UNITS.push(mk(f, `W${f}C`, "C1"));
}

// Loan B — North facing: F1 has 3 units (CC takes east end), F2–F7 have 4 = 27 units
const LOAN_B_UNITS: Unit[] = [];
for (let f = 1; f <= 7; f++) {
  if (f === 1) {
    LOAN_B_UNITS.push(mk(1, "N1A", "B1"));
    LOAN_B_UNITS.push(mk(1, "N1B", "C1"));
    LOAN_B_UNITS.push(mk(1, "N1C", "C1"));
  } else {
    LOAN_B_UNITS.push(mk(f, `N${f}A`, "B1"));
    LOAN_B_UNITS.push(mk(f, `N${f}B`, "B1"));
    LOAN_B_UNITS.push(mk(f, `N${f}C`, "C1"));
    LOAN_B_UNITS.push(mk(f, `N${f}D`, "C1"));
  }
}

const SF_A = LOAN_A_UNITS.reduce((s, u) => s + u.sf, 0); // 26,775
const SF_B = LOAN_B_UNITS.reduce((s, u) => s + u.sf, 0); // 33,300
const SF_TOTAL = SF_A + SF_B; // 60,075
const FRAC_A = SF_A / SF_TOTAL; // 0.4457
const FRAC_B = SF_B / SF_TOTAL; // 0.5543

const BASE_VALUE_A = LOAN_A_UNITS.reduce((s, u) => s + u.value, 0); // 30,504,375
const BASE_VALUE_B = LOAN_B_UNITS.reduce((s, u) => s + u.value, 0); // 38,193,750
const BASE_TOTAL = BASE_VALUE_A + BASE_VALUE_B;

// SF-proportional basis (deal-stated round figures; premium = 0 state)
const SF_BASIS_A = 15_750_000;
const SF_BASIS_B = 19_550_000;

const LOAN_MIN = 5_000_000;
const LOAN_MAX = 30_000_000;
const LOAN_STEP = 250_000;
const PREMIUM_MAX = 4_000_000;
const PREMIUM_STEP = 250_000;

/* ------------------------------------------------------------------ */
/* Formatting helpers                                                  */
/* ------------------------------------------------------------------ */
const usd = (n: number) =>
  "$" + Math.round(n).toLocaleString("en-US");
const usd2 = (n: number) =>
  "$" +
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const pct1 = (n: number) => (n * 100).toFixed(1) + "%";

function ltvTone(ltv: number) {
  if (ltv < 0.65) return { label: "green", color: "#147a3d", bg: "#e7f5ec" };
  if (ltv < 0.8) return { label: "amber", color: "#b97e0a", bg: "#fbf2dd" };
  return { label: "red", color: "#b3261e", bg: "#fbe6e4" };
}

/* ------------------------------------------------------------------ */
/* Small presentational pieces                                         */
/* ------------------------------------------------------------------ */
function TypePill({ type }: { type: UnitType }) {
  const c = type === "B1" ? C.blue : C.green;
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white"
      style={{ background: c }}
    >
      {type}
    </span>
  );
}

function PlanImage({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div
        className="flex h-full min-h-[220px] w-full flex-col items-center justify-center gap-2 px-6 py-10 text-center"
        style={{ background: "#f1ece1", border: `1px dashed ${C.gold}` }}
      >
        <span
          className="text-xs font-bold uppercase tracking-widest"
          style={{ color: C.gold }}
        >
          Plan image pending
        </span>
        <span className="text-sm" style={{ color: C.ink }}>
          Drop the source image at
        </span>
        <code
          className="rounded px-2 py-1 text-xs"
          style={{ background: "#fff", color: C.navy, border: `1px solid ${C.line}` }}
        >
          {src}
        </code>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      onError={() => setErr(true)}
      className="block h-auto w-full"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Unit schedule table                                                 */
/* ------------------------------------------------------------------ */
function UnitTable({
  units,
  accent,
  loanAmount,
}: {
  units: Unit[];
  accent: string;
  loanAmount: number;
  includeCC?: boolean;
}) {
  const totalSf = units.reduce((s, u) => s + u.sf, 0);
  const totalValue = units.reduce((s, u) => s + u.value, 0);
  return (
    <div className="overflow-x-auto rounded-lg border" style={{ borderColor: C.line, background: "#fff" }}>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr style={{ background: accent, color: "#fff" }}>
            <th className="px-2 py-2 text-left font-semibold">Floor</th>
            <th className="px-2 py-2 text-left font-semibold">Unit</th>
            <th className="px-2 py-2 text-left font-semibold">Type</th>
            <th className="px-2 py-2 text-left font-semibold">BR / BA</th>
            <th className="px-2 py-2 text-right font-semibold">SF</th>
            <th className="px-2 py-2 text-right font-semibold">Base $/SF</th>
            <th className="px-2 py-2 text-right font-semibold">Base value</th>
          </tr>
        </thead>
        <tbody>
          {units.map((u, i) => (
            <tr
              key={u.id}
              style={{ background: i % 2 ? "#faf8f3" : "#fff" }}
            >
              <td className="px-2 py-1.5 tabular-nums" style={{ color: C.ink }}>
                F{u.floor}
              </td>
              <td className="px-2 py-1.5 font-semibold" style={{ color: C.navy }}>
                {u.id}
              </td>
              <td className="px-2 py-1.5">
                <TypePill type={u.type} />
              </td>
              <td className="px-2 py-1.5" style={{ color: C.ink }}>
                {u.brba}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: C.ink }}>
                {u.sf.toLocaleString()}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums" style={{ color: C.ink }}>
                ${u.rate.toLocaleString()}
              </td>
              <td className="px-2 py-1.5 text-right tabular-nums font-medium" style={{ color: C.navy }}>
                {usd(u.value)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: "#f1ece1", color: C.navy }}>
            <td className="px-2 py-2 font-bold" colSpan={4}>
              {units.length} units
            </td>
            <td className="px-2 py-2 text-right font-bold tabular-nums">
              {totalSf.toLocaleString()} SF
            </td>
            <td className="px-2 py-2" />
            <td className="px-2 py-2 text-right font-bold tabular-nums">
              {usd(totalValue)}
            </td>
          </tr>
        </tfoot>
      </table>
      <div
        className="px-3 py-2 text-xs italic"
        style={{ color: C.ink, borderTop: `1px solid ${C.line}` }}
      >
        Loan amount ={" "}
        <strong style={{ color: accent }}>
          {usd2(loanAmount / totalSf)}/SF
        </strong>{" "}
        on {totalSf.toLocaleString()} collateral SF
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Orientation diagram (Section 4)                                     */
/* ------------------------------------------------------------------ */
function OrientationDiagram() {
  const gridLeft = 56;
  const gridTop = 92;
  const colW = 76;
  const rowH = 44;
  const cols = 8;
  const floors = 7;

  const COL_HEADERS = [
    "W·B1",
    "W·B1",
    "W·C1",
    "CORE",
    "N·B1",
    "N·B1",
    "N·C1",
    "N·C1",
  ];

  // Returns the cell descriptor for a (col, floor) slot.
  function cellFor(col: number, f: number) {
    if (col <= 2) {
      const id = `W${f}${["A", "B", "C"][col]}`;
      const type = col === 2 ? "C1" : "B1";
      return { kind: "west" as const, id, type };
    }
    if (col === 3) return { kind: "core" as const, id: "CORE", type: "" };
    // North columns 4..7
    if (f === 1) {
      // F1 North: N1A(B1), N1B(C1), N1C(C1), CC at far/east end
      const map: Record<number, { id: string; type: string }> = {
        4: { id: "N1A", type: "B1" },
        5: { id: "N1B", type: "C1" },
        6: { id: "N1C", type: "C1" },
        7: { id: "CC", type: "" },
      };
      const m = map[col];
      return col === 7
        ? { kind: "cc" as const, id: m.id, type: m.type }
        : { kind: "north" as const, id: m.id, type: m.type };
    }
    const id = `N${f}${["A", "B", "C", "D"][col - 4]}`;
    const type = col <= 5 ? "B1" : "C1";
    return { kind: "north" as const, id, type };
  }

  const cells = [];
  for (let f = floors; f >= 1; f--) {
    for (let col = 0; col < cols; col++) {
      const c = cellFor(col, f);
      const x = gridLeft + col * colW + 2;
      const y = gridTop + (floors - f) * rowH + 2;
      const w = colW - 4;
      const h = rowH - 4;
      const fill =
        c.kind === "west"
          ? C.blue
          : c.kind === "north"
          ? C.green
          : c.kind === "core"
          ? "#cfc8ba"
          : "url(#ccStripe)";
      const textColor = c.kind === "core" ? "#3b3b3b" : "#fff";
      cells.push(
        <g key={`${f}-${col}`}>
          <rect x={x} y={y} width={w} height={h} rx={3} fill={fill} stroke="#ffffff66" />
          {c.kind === "cc" ? (
            <>
              <text
                x={x + w / 2}
                y={y + h / 2 - 4}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#fff"
              >
                COMM
              </text>
              <text
                x={x + w / 2}
                y={y + h / 2 + 8}
                textAnchor="middle"
                fontSize="9"
                fontWeight="700"
                fill="#fff"
              >
                CTR
              </text>
            </>
          ) : c.kind === "core" ? (
            <text
              x={x + w / 2}
              y={y + h / 2 + 4}
              textAnchor="middle"
              fontSize="9"
              fontWeight="700"
              fill={textColor}
              letterSpacing="1"
            >
              CORE
            </text>
          ) : (
            <>
              <text
                x={x + w / 2}
                y={y + h / 2 - 3}
                textAnchor="middle"
                fontSize="11"
                fontWeight="700"
                fill={textColor}
              >
                {c.id}
              </text>
              <text
                x={x + w / 2}
                y={y + h / 2 + 9}
                textAnchor="middle"
                fontSize="8"
                fill="#ffffffcc"
              >
                {c.type}
              </text>
            </>
          )}
        </g>
      );
    }
  }

  const westRight = gridLeft + 3 * colW;
  const northLeft = gridLeft + 4 * colW;
  const northRight = gridLeft + 8 * colW;
  const gridBottom = gridTop + floors * rowH;

  return (
    <svg
      viewBox="0 0 700 520"
      className="h-auto w-full"
      role="img"
      aria-label="Building orientation: West wing (Loan A) and North wing (Loan B) with Community Center"
    >
      <defs>
        <pattern
          id="ccStripe"
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <rect width="8" height="8" fill={C.green} />
          <rect width="4" height="8" fill="#0b5743" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="700" height="520" fill="#fff" />

      {/* Compass rose, top-right */}
      <g transform="translate(640,44)">
        <circle r="26" fill="none" stroke={C.navy} strokeWidth="1.2" />
        <line x1="0" y1="-26" x2="0" y2="26" stroke={C.navy} strokeWidth="1" />
        <line x1="-26" y1="0" x2="26" y2="0" stroke={C.navy} strokeWidth="1" />
        <polygon points="0,-26 -4,-14 4,-14" fill={C.gold} />
        <text x="0" y="-30" textAnchor="middle" fontSize="11" fontWeight="700" fill={C.navy}>
          N
        </text>
        <text x="34" y="4" textAnchor="middle" fontSize="10" fill={C.navy}>
          E
        </text>
        <text x="-34" y="4" textAnchor="middle" fontSize="10" fill={C.navy}>
          W
        </text>
      </g>

      {/* Boundary boxes */}
      <rect
        x={gridLeft - 4}
        y={gridTop - 22}
        width={3 * colW + 8}
        height={floors * rowH + 26}
        rx={6}
        fill="none"
        stroke={C.blue}
        strokeWidth="2.5"
        strokeDasharray="6 4"
      />
      <text x={gridLeft - 2} y={gridTop - 28} fontSize="11" fontWeight="700" fill={C.blue}>
        LOAN A — WEST FACING
      </text>
      <rect
        x={northLeft - 4}
        y={gridTop - 22}
        width={4 * colW + 8}
        height={floors * rowH + 26}
        rx={6}
        fill="none"
        stroke={C.green}
        strokeWidth="2.5"
        strokeDasharray="6 4"
      />
      <text x={northLeft - 2} y={gridTop - 28} fontSize="11" fontWeight="700" fill={C.green}>
        LOAN B — NORTH FACING
      </text>

      {/* Column headers */}
      {COL_HEADERS.map((h, i) => (
        <text
          key={h + i}
          x={gridLeft + i * colW + colW / 2}
          y={gridTop - 6}
          textAnchor="middle"
          fontSize="9"
          fontWeight="600"
          fill={i === 3 ? "#6b6b6b" : C.navy}
        >
          {h}
        </text>
      ))}

      {/* Floor labels */}
      {Array.from({ length: floors }, (_, i) => {
        const f = floors - i;
        const y = gridTop + i * rowH + rowH / 2 + 4;
        return (
          <text
            key={f}
            x={gridLeft - 12}
            y={y}
            textAnchor="end"
            fontSize="11"
            fontWeight="700"
            fill={C.navy}
          >
            F{f}
          </text>
        );
      })}

      {cells}

      {/* Wing direction labels */}
      <text
        x={(gridLeft + westRight) / 2}
        y={gridBottom + 26}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill={C.blue}
      >
        ← WEST WING · Loan A · Gulf / Sunset
      </text>
      <text
        x={(northLeft + northRight) / 2}
        y={gridBottom + 26}
        textAnchor="middle"
        fontSize="11"
        fontWeight="700"
        fill={C.green}
      >
        NORTH WING · Loan B · Matlacha Pass →
      </text>
      <text
        x={(gridLeft + northRight) / 2}
        y={gridBottom + 48}
        textAnchor="middle"
        fontSize="10"
        fill="#6b6b6b"
      >
        Community Center occupies the east end of Floor 1, North wing —
        included in Loan B collateral boundary, non-sellable.
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Loan panel (Section 2)                                              */
/* ------------------------------------------------------------------ */
function LoanPanel({
  title,
  subtitle,
  accent,
  units,
  sf,
  baseValue,
  loan,
  setLoan,
  basis,
  premiumNote,
  overridden,
  note,
}: {
  title: string;
  subtitle: string;
  accent: string;
  units: number;
  sf: number;
  baseValue: number;
  loan: number;
  setLoan: (n: number) => void;
  basis: number;
  premiumNote: string;
  overridden: boolean;
  note?: string;
}) {
  const ltv = loan / baseValue;
  const tone = ltvTone(ltv);
  const perUnit = loan / units;
  return (
    <div
      className="flex flex-col rounded-xl border bg-white p-5 shadow-sm"
      style={{ borderTop: `5px solid ${accent}`, borderColor: C.line }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-display text-lg font-bold" style={{ color: accent }}>
            {title}
          </h3>
          <p className="text-xs" style={{ color: C.ink }}>
            {subtitle}
          </p>
        </div>
        {overridden && (
          <span
            className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
            style={{ background: "#fbf2dd", color: "#b97e0a" }}
          >
            Overridden
          </span>
        )}
      </div>

      <div className="mt-4 flex items-end justify-between">
        <span className="font-display text-2xl font-bold tabular-nums" style={{ color: C.navy }}>
          {usd(loan)}
        </span>
        <span
          className="rounded-md px-2 py-1 text-sm font-bold tabular-nums"
          style={{ background: tone.bg, color: tone.color }}
        >
          {pct1(ltv)} LTV
        </span>
      </div>

      <input
        type="range"
        min={LOAN_MIN}
        max={LOAN_MAX}
        step={LOAN_STEP}
        value={loan}
        onChange={(e) => setLoan(Number(e.target.value))}
        className="mt-3"
        style={{ accentColor: accent }}
        aria-label={`${title} loan amount`}
      />
      <div className="mt-1 flex justify-between text-[10px]" style={{ color: "#8a8270" }}>
        <span>{usd(LOAN_MIN)}</span>
        <span>{usd(LOAN_MAX)}</span>
      </div>
      <p className="mt-2 text-xs" style={{ color: C.ink }}>
        SF basis: <strong>{usd(basis)}</strong> · {premiumNote}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <Metric label="Base collateral" value={usd(baseValue)} />
        <Metric label="$/unit" value={usd(perUnit)} />
        <Metric label="Collateral SF" value={sf.toLocaleString()} />
      </div>

      {note && (
        <p
          className="mt-3 rounded-md px-2 py-1.5 text-[11px] italic"
          style={{ background: "#f1ece1", color: C.ink }}
        >
          {note}
        </p>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg px-1 py-2" style={{ background: "#faf8f3" }}>
      <div className="text-sm font-bold tabular-nums" style={{ color: C.navy }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "#8a8270" }}>
        {label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Reference plan card (Section 5)                                     */
/* ------------------------------------------------------------------ */
function PlanCard({
  title,
  src,
  desc,
}: {
  title: string;
  src: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-white shadow-sm" style={{ borderColor: C.line }}>
      <div className="px-4 py-3" style={{ background: C.navy }}>
        <h4 className="font-display text-sm font-bold tracking-wide" style={{ color: C.gold }}>
          {title}
        </h4>
      </div>
      <div className="bg-[#f6f2e9]">
        <PlanImage src={src} alt={title} />
      </div>
      <p className="px-4 py-3 text-xs leading-relaxed" style={{ color: C.ink }}>
        {desc}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Home() {
  const [premium, setPremium] = useState(0);
  const [loanA, setLoanA] = useState(SF_BASIS_A);
  const [loanB, setLoanB] = useState(SF_BASIS_B);

  const formulaA = SF_BASIS_A + premium;
  const formulaB = SF_BASIS_B - premium;
  const overriddenA = loanA !== formulaA;
  const overriddenB = loanB !== formulaB;

  // Moving the premium re-establishes the SF-proportional relationship and
  // shifts dollars from Loan B to Loan A while holding total debt constant.
  function changePremium(p: number) {
    setPremium(p);
    setLoanA(SF_BASIS_A + p);
    setLoanB(SF_BASIS_B - p);
  }

  function reset() {
    setPremium(0);
    setLoanA(SF_BASIS_A);
    setLoanB(SF_BASIS_B);
  }

  const totalDebt = loanA + loanB;
  const blendedLtv = totalDebt / BASE_TOTAL;
  const ltvA = loanA / BASE_VALUE_A;
  const ltvB = loanB / BASE_VALUE_B;
  const shareA = totalDebt > 0 ? loanA / totalDebt : 0.5;
  const shareB = 1 - shareA;

  const status = useMemo(() => {
    if (ltvA >= 0.8 || ltvB >= 0.8)
      return {
        tone: { color: "#fff", bg: "#b3261e" },
        msg: "⚠ LTV exceeds 80% on one or both loans — collateral over-leveraged. Reduce loan amount.",
      };
    if (overriddenA || overriddenB)
      return {
        tone: { color: "#7a5400", bg: "#fbf2dd" },
        msg: "Manual override active — one or both loans no longer match the SF-proportional basis. Use “Reset to SF basis” to restore the formula.",
      };
    return {
      tone: { color: "#0f5c2e", bg: "#e7f5ec" },
      msg: "Clean SF-proportional split. Both loans within target LTV.",
    };
  }, [ltvA, ltvB, overriddenA, overriddenB]);

  const premiumNoteA =
    premium > 0
      ? `West premium adds: ${usd(premium)}`
      : "West premium adds: $0";
  const premiumNoteB =
    premium > 0
      ? `West premium subtracts: ${usd(premium)}`
      : "West premium subtracts: $0";

  return (
    <main className="flex-1" style={{ background: C.cream }}>
      {/* ---------------- Section 1 — Header ---------------- */}
      <header className="px-6 py-10 text-center sm:py-14" style={{ background: C.navy }}>
        <h1
          className="font-display text-2xl font-bold leading-tight tracking-[0.18em] sm:text-4xl"
          style={{ color: C.gold }}
        >
          LAKE SHADROE RESORT &amp; MARINA
        </h1>
        <p className="mt-3 text-base font-medium tracking-wide sm:text-lg" style={{ color: "#e8ecf2" }}>
          Two-Loan Construction Structure — Lender Reference Tool
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-sm" style={{ color: "#aab8cc" }}>
          218 Burnt Store Rd S, Cape Coral, FL · 48 Units · 7 Floors · Matlacha
          Pass Waterfront
        </p>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        {/* ---------------- Section 2 — Loan Sizing Tool ---------------- */}
        <section>
          <SectionHeading n="01" title="Loan Sizing Tool" />

          {/* West premium slider */}
          <div className="rounded-xl border bg-white p-5 shadow-sm" style={{ borderColor: C.line }}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <label className="text-sm font-bold" style={{ color: C.navy }}>
                West facing view premium
                <span className="ml-2 font-normal" style={{ color: C.ink }}>
                  — Gulf / sunset exposure
                </span>
              </label>
              <span className="font-display text-xl font-bold tabular-nums" style={{ color: C.gold }}>
                {usd(premium)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={PREMIUM_MAX}
              step={PREMIUM_STEP}
              value={premium}
              onChange={(e) => changePremium(Number(e.target.value))}
              className="mt-3"
              aria-label="West facing view premium"
            />
            <div className="mt-1 flex justify-between text-[10px]" style={{ color: "#8a8270" }}>
              <span>$0</span>
              <span>{usd(PREMIUM_MAX)}</span>
            </div>
            <p className="mt-3 text-sm" style={{ color: C.ink }}>
              Shifts dollars from Loan B to Loan A on top of the SF-proportional
              base, holding total debt constant.{" "}
              <span className="font-semibold" style={{ color: C.blue }}>
                Loan A → {usd(formulaA)}
              </span>{" "}
              ·{" "}
              <span className="font-semibold" style={{ color: C.green }}>
                Loan B → {usd(formulaB)}
              </span>
            </p>
          </div>

          {/* Two loan panels */}
          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
            <LoanPanel
              title="Loan A — West Facing"
              subtitle={`21 units · ${SF_A.toLocaleString()} SF · ${pct1(FRAC_A)} of residential SF`}
              accent={C.blue}
              units={21}
              sf={SF_A}
              baseValue={BASE_VALUE_A}
              loan={loanA}
              setLoan={setLoanA}
              basis={SF_BASIS_A}
              premiumNote={premiumNoteA}
              overridden={overriddenA}
            />
            <LoanPanel
              title="Loan B — North Facing"
              subtitle={`27 units + Community Center · ${SF_B.toLocaleString()} SF · ${pct1(FRAC_B)} of residential SF`}
              accent={C.green}
              units={27}
              sf={SF_B}
              baseValue={BASE_VALUE_B}
              loan={loanB}
              setLoan={setLoanB}
              basis={SF_BASIS_B}
              premiumNote={premiumNoteB}
              overridden={overriddenB}
              note="Community Center is a non-sellable amenity included in the Loan B land-condo collateral boundary."
            />
          </div>

          {/* Summary strip */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Total debt" value={usd(totalDebt)} accent={C.navy} />
            <SummaryStat label="Total collateral (base)" value={usd(BASE_TOTAL)} accent={C.navy} />
            <SummaryStat label="Blended LTV" value={pct1(blendedLtv)} accent={ltvTone(blendedLtv).color} />
            <SummaryStat
              label="SF split (West / North)"
              value={`${pct1(FRAC_A)} / ${pct1(FRAC_B)}`}
              accent={C.navy}
            />
          </div>

          {/* Split bar */}
          <div className="mt-5">
            <div className="mb-1 flex justify-between text-xs font-semibold">
              <span style={{ color: C.blue }}>Loan A {pct1(shareA)}</span>
              <span style={{ color: C.green }}>Loan B {pct1(shareB)}</span>
            </div>
            <div className="flex h-7 overflow-hidden rounded-full" style={{ border: `1px solid ${C.line}` }}>
              <div
                className="flex items-center justify-center text-[11px] font-bold text-white transition-all"
                style={{ width: `${shareA * 100}%`, background: C.blue }}
              >
                {shareA > 0.12 ? usd(loanA) : ""}
              </div>
              <div
                className="flex items-center justify-center text-[11px] font-bold text-white transition-all"
                style={{ width: `${shareB * 100}%`, background: C.green }}
              >
                {shareB > 0.12 ? usd(loanB) : ""}
              </div>
            </div>
          </div>

          {/* Reset + status */}
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={reset}
              className="shrink-0 rounded-lg px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-90"
              style={{ background: C.navy }}
            >
              Reset to SF basis
            </button>
            <div
              className="flex-1 rounded-lg px-4 py-2 text-sm font-medium"
              style={{ background: status.tone.bg, color: status.tone.color }}
            >
              {status.msg}
            </div>
          </div>
        </section>

        {/* ---------------- Section 3 — Unit Schedules ---------------- */}
        <section className="mt-14">
          <SectionHeading n="02" title="Unit Schedules" />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <div>
              <h3 className="mb-2 font-display text-base font-bold" style={{ color: C.blue }}>
                Loan A — West Facing · 21 Units
              </h3>
              <UnitTable units={LOAN_A_UNITS} accent={C.blue} loanAmount={loanA} />
            </div>
            <div>
              <h3 className="mb-2 font-display text-base font-bold" style={{ color: C.green }}>
                Loan B — North Facing · 27 Units + Community Center
              </h3>
              <UnitTable units={LOAN_B_UNITS} accent={C.green} loanAmount={loanB} />
              <div
                className="mt-2 flex items-center gap-3 rounded-lg border px-3 py-2 text-xs"
                style={{ borderColor: C.line, background: "#fff", color: C.ink }}
              >
                <span
                  className="inline-block rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
                  style={{ background: C.green }}
                >
                  CC
                </span>
                <span>
                  <strong>F1 · Community Center</strong> · Amenity · non-sellable
                  · included in Loan B land-condo collateral boundary (no SF /
                  base value assigned).
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Section 4 — Orientation Diagram ---------------- */}
        <section className="mt-14">
          <SectionHeading n="03" title="Building Orientation" />
          <div className="rounded-xl border bg-white p-4 shadow-sm" style={{ borderColor: C.line }}>
            <OrientationDiagram />
          </div>
        </section>

        {/* ---------------- Section 5 — Reference Plans ---------------- */}
        <section className="mt-14">
          <SectionHeading n="04" title="Reference Plans" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <PlanCard
              title="Proposed First Floor Plan"
              src="/plans/floor-plan-f1-full.png"
              desc="L-shaped building footprint. West wing runs north-south (Loan A). North wing runs east-west (Loan B). Community Center at east end of North wing, Floor 1."
            />
            <PlanCard
              title="Unit Plan — C1 · 2BR/2BA · 1,125 SF"
              src="/plans/unit-c1-2br.png"
              desc={`Living room 13'1"×14'5", Kitchen 8'1"×11'3", Bedroom 2 11'×17'7", M.Bath, Bath-2, Laundry, Patio 8'×24'8"`}
            />
            <PlanCard
              title="Unit Plan — B1 · 3BR/3BA · 1,350 SF"
              src="/plans/unit-b1-3br.png"
              desc={`Master Bed 14'2"×12', Great Room 19'5"×12'6", Bedroom 2 13'2"×13'4", Bedroom 3 12'×17'8", M.Bath, M.WIC, Bath-2, Laundry, Patio 40'2"×8'`}
            />
            <PlanCard
              title="Site Construction Plan"
              src="/plans/site-construction-plan.png"
              desc={`218 Burnt Store Rd S, Cape Coral FL · 145,537 SF site · 22,526 SF building footprint · 48 units · 7 floors · 15,142 SF/floor · 58'-10" height · III-B Sprinkled · Short Term Lodging`}
            />
          </div>
        </section>
      </div>

      {/* ---------------- Section 6 — Footer ---------------- */}
      <footer className="px-6 py-8 text-center text-xs" style={{ background: C.navy, color: "#aab8cc" }}>
        <p className="font-display tracking-wide" style={{ color: C.gold }}>
          Vantage Point Investments
        </p>
        <p className="mt-2">
          218 Burnt Store Rd S, Cape Coral FL · rob@vpiflorida.com · FL Realtor
          SL3481954
        </p>
        <p className="mt-1 font-semibold tracking-wide" style={{ color: "#e8ecf2" }}>
          Confidential — For Lender Use Only
        </p>
      </footer>
    </main>
  );
}

function SectionHeading({ n, title }: { n: string; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <span
        className="font-display text-sm font-bold tabular-nums"
        style={{ color: C.gold }}
      >
        {n}
      </span>
      <h2 className="font-display text-xl font-bold tracking-wide sm:text-2xl" style={{ color: C.navy }}>
        {title}
      </h2>
      <span className="h-px flex-1" style={{ background: C.line }} />
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border bg-white px-4 py-3 text-center shadow-sm" style={{ borderColor: C.line }}>
      <div className="font-display text-lg font-bold tabular-nums sm:text-xl" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-wide sm:text-xs" style={{ color: "#8a8270" }}>
        {label}
      </div>
    </div>
  );
}
