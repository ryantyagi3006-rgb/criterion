"use client";
import { useState } from "react";
import { TOOLS } from "@/lib/tools";
import GeoGebra from "./GeoGebra";

// Renders only the tools assigned to the current question.
export default function ToolsPanel({ toolIds }: { toolIds: string[] }) {
  const [open, setOpen] = useState<string | null>(toolIds[0] ?? null);
  if (toolIds.length === 0)
    return <p className="text-xs text-soft text-center py-4">No tools needed for this question.</p>;

  return (
    <div className="space-y-2">
      {toolIds.map((id) => (
        <div key={id} className="rounded-lg border border-line overflow-hidden">
          <button onClick={() => setOpen(open === id ? null : id)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold text-ink bg-paper">
            <span>{TOOLS[id].label}</span>
            <span className="text-soft text-xs">{open === id ? "Hide" : "Show"}</span>
          </button>
          {open === id && <div className="p-3 bg-surface">{renderTool(id)}</div>}
        </div>
      ))}
    </div>
  );
}

function renderTool(id: string) {
  switch (id) {
    case "calculator": return <Calculator />;
    case "graphing": return <GeoGebra appName="graphing" height={420} />;
    case "formula_sheet": return <FormulaSheet />;
    case "periodic_table": return <PeriodicTable />;
    case "unit_converter": return <UnitConverter />;
    case "spreadsheet": return <p className="text-xs text-soft">Use the table editor in the answer area to enter data.</p>;
    case "code_editor": return <p className="text-xs text-soft">Use the code editor in the answer area. Run executes JavaScript.</p>;
    case "dictionary": return <WordTools />;
    case "map": return <CoordinateGrid />;
    default: return null;
  }
}

/* ---------- Scientific calculator (safe expression parser) ---------- */
function evaluate(expr: string): number {
  const tokens = expr.replace(/\s+/g, "")
    .replace(/π/g, "(3.141592653589793)")
    .replace(/\be\b/g, "(2.718281828459045)")
    .match(/(\d+\.?\d*|[+\-*/^()]|sin|cos|tan|asin|acos|atan|log|ln|sqrt|abs)/g);
  if (!tokens || tokens.join("") !== expr.replace(/\s+/g, "").replace(/π/g, "(3.141592653589793)").replace(/\be\b/g, "(2.718281828459045)"))
    throw new Error("bad input");
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  function parseExpr(): number {
    let v = parseTerm();
    while (peek() === "+" || peek() === "-") v = next() === "+" ? v + parseTerm() : v - parseTerm();
    return v;
  }
  function parseTerm(): number {
    let v = parsePow();
    while (peek() === "*" || peek() === "/") v = next() === "*" ? v * parsePow() : v / parsePow();
    return v;
  }
  function parsePow(): number {
    const base = parseUnary();
    if (peek() === "^") { next(); return Math.pow(base, parsePow()); }
    return base;
  }
  function parseUnary(): number {
    if (peek() === "-") { next(); return -parseUnary(); }
    return parseAtom();
  }
  function parseAtom(): number {
    const t = next();
    if (t === "(") { const v = parseExpr(); next(); return v; }
    const fns: Record<string, (x: number) => number> = {
      sin: (x) => Math.sin(x), cos: (x) => Math.cos(x), tan: (x) => Math.tan(x),
      asin: Math.asin, acos: Math.acos, atan: Math.atan,
      log: Math.log10, ln: Math.log, sqrt: Math.sqrt, abs: Math.abs,
    };
    if (t in fns) { next(); const v = parseExpr(); next(); return fns[t](v); }
    const n = parseFloat(t);
    if (isNaN(n)) throw new Error("bad token");
    return n;
  }
  const result = parseExpr();
  if (i < tokens.length || isNaN(result)) throw new Error("bad expression");
  return result;
}

const keyBtn = "rounded-lg border border-line bg-paper hover:border-teal py-2 text-xs font-semibold text-ink transition-colors";

function Calculator() {
  const [display, setDisplay] = useState("");
  const [prev, setPrev] = useState("");
  const keys = ["7","8","9","/","sin(","4","5","6","*","cos(","1","2","3","-","tan(","0",".","π","+","sqrt(","(",")","^","ln(","log("];
  function press(k: string) { setDisplay((d) => d + k); }
  function eq() {
    try { const r = evaluate(display); setPrev(display + " ="); setDisplay(String(Math.round(r * 1e10) / 1e10)); }
    catch { setPrev("Error"); }
  }
  return (
    <div>
      <div className="rounded-lg bg-paper border border-line p-2 mb-2 text-right">
        <div className="text-[10px] text-soft h-3.5 truncate">{prev}</div>
        <input value={display} onChange={(e) => setDisplay(e.target.value)} onKeyDown={(e) => e.key === "Enter" && eq()}
          className="w-full bg-transparent text-right font-mono text-lg outline-none text-ink" aria-label="Calculator display" />
      </div>
      <div className="grid grid-cols-5 gap-1">
        {keys.map((k) => (
          <button key={k} onClick={() => press(k)} className={keyBtn}>
            {k.replace("(", "")}
          </button>
        ))}
        <button onClick={() => setDisplay("")} className="rounded-lg bg-amberwash text-amber py-2 text-xs font-bold">C</button>
        <button onClick={() => setDisplay((d) => d.slice(0, -1))} className={keyBtn}>del</button>
        <button onClick={eq} className="col-span-3 rounded-lg bg-teal text-paper py-2 text-xs font-bold">=</button>
      </div>
      <p className="text-[10px] text-soft mt-1.5">Trig in radians. Supports sin cos tan log ln sqrt ^ π</p>
    </div>
  );
}

/* ---------- Formula sheet ---------- */
function FormulaSheet() {
  const sections: [string, string[]][] = [
    ["Algebra", ["x = (−b ± √(b²−4ac)) / 2a", "(a+b)² = a² + 2ab + b²", "aᵐ·aⁿ = aᵐ⁺ⁿ"]],
    ["Geometry", ["A(circle) = πr²", "C = 2πr", "V(cylinder) = πr²h", "a² + b² = c²"]],
    ["Trigonometry", ["sinθ = opp/hyp · cosθ = adj/hyp · tanθ = opp/adj", "a/sinA = b/sinB = c/sinC", "c² = a² + b² − 2ab·cosC"]],
    ["Statistics", ["mean = Σx / n", "P(A∪B) = P(A) + P(B) − P(A∩B)"]],
    ["Financial", ["Simple: I = Prt", "Compound: A = P(1 + r/n)ⁿᵗ"]],
    ["Physics", ["v = u + at", "s = ut + ½at²", "F = ma", "E = mc²", "W = Fs", "P = W/t"]],
  ];
  return (
    <div className="space-y-3 text-xs">
      {sections.map(([title, rows]) => (
        <div key={title}>
          <div className="font-bold text-ink">{title}</div>
          {rows.map((r) => <div key={r} className="font-mono text-soft mt-0.5">{r}</div>)}
        </div>
      ))}
    </div>
  );
}

/* ---------- Periodic table (compact) ---------- */
const ELEMENTS: [string, string, number, string][] = [
  ["H","Hydrogen",1,"1.008"],["He","Helium",2,"4.003"],["Li","Lithium",3,"6.94"],["Be","Beryllium",4,"9.012"],
  ["B","Boron",5,"10.81"],["C","Carbon",6,"12.011"],["N","Nitrogen",7,"14.007"],["O","Oxygen",8,"15.999"],
  ["F","Fluorine",9,"18.998"],["Ne","Neon",10,"20.180"],["Na","Sodium",11,"22.990"],["Mg","Magnesium",12,"24.305"],
  ["Al","Aluminium",13,"26.982"],["Si","Silicon",14,"28.085"],["P","Phosphorus",15,"30.974"],["S","Sulfur",16,"32.06"],
  ["Cl","Chlorine",17,"35.45"],["Ar","Argon",18,"39.948"],["K","Potassium",19,"39.098"],["Ca","Calcium",20,"40.078"],
  ["Fe","Iron",26,"55.845"],["Cu","Copper",29,"63.546"],["Zn","Zinc",30,"65.38"],["Ag","Silver",47,"107.87"],
  ["Au","Gold",79,"196.97"],["Pb","Lead",82,"207.2"],
];
function PeriodicTable() {
  const [sel, setSel] = useState<typeof ELEMENTS[0] | null>(null);
  const [q, setQ] = useState("");
  const filtered = ELEMENTS.filter(([sym, name]) => (sym + name).toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search element"
        className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-xs outline-none mb-2 text-ink" />
      {sel && (
        <div className="rounded-lg bg-tealwash p-2 mb-2 text-xs text-tealdeep">
          <b>{sel[1]}</b> ({sel[0]}), Z = {sel[2]}, mass {sel[3]}
        </div>
      )}
      <div className="grid grid-cols-6 gap-1">
        {filtered.map((el) => (
          <button key={el[0]} onClick={() => setSel(el)}
            className="rounded-md border border-line bg-paper hover:border-teal py-1.5 text-center transition-colors">
            <div className="text-[9px] text-soft">{el[2]}</div>
            <div className="text-xs font-bold text-ink">{el[0]}</div>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-soft mt-1.5">Common elements shown. Search to filter.</p>
    </div>
  );
}

/* ---------- Unit converter ---------- */
const UNITS: Record<string, Record<string, number>> = {
  Length: { mm: 0.001, cm: 0.01, m: 1, km: 1000, inch: 0.0254, ft: 0.3048, mile: 1609.34 },
  Mass: { mg: 0.001, g: 1, kg: 1000, tonne: 1e6, lb: 453.592, oz: 28.3495 },
  Volume: { mL: 0.001, L: 1, "m³": 1000, gallon: 3.78541 },
  Time: { s: 1, min: 60, hour: 3600, day: 86400 },
};
function UnitConverter() {
  const [cat, setCat] = useState("Length");
  const [from, setFrom] = useState("m");
  const [to, setTo] = useState("cm");
  const [val, setVal] = useState("1");
  const units = UNITS[cat];
  const result = (parseFloat(val) || 0) * (units[from] ?? 1) / (units[to] ?? 1);
  const sel = "rounded-lg border border-line bg-paper px-2 py-1.5 text-xs outline-none text-ink";
  return (
    <div className="space-y-2 text-xs">
      <select className={`${sel} w-full`} value={cat} onChange={(e) => { setCat(e.target.value); const ks = Object.keys(UNITS[e.target.value]); setFrom(ks[0]); setTo(ks[1]); }}>
        {Object.keys(UNITS).map((c) => <option key={c}>{c}</option>)}
      </select>
      <div className="flex items-center gap-1.5">
        <input className={`${sel} flex-1 min-w-0`} value={val} onChange={(e) => setVal(e.target.value)} aria-label="Value" />
        <select className={sel} value={from} onChange={(e) => setFrom(e.target.value)}>
          {Object.keys(units).map((u) => <option key={u}>{u}</option>)}
        </select>
        <span className="text-soft">to</span>
        <select className={sel} value={to} onChange={(e) => setTo(e.target.value)}>
          {Object.keys(units).map((u) => <option key={u}>{u}</option>)}
        </select>
      </div>
      <div className="rounded-lg bg-paper border border-line p-2 font-mono text-center text-ink">
        {Number.isFinite(result) ? +result.toPrecision(8) : "?"} {to}
      </div>
    </div>
  );
}

/* ---------- Word tools ---------- */
function WordTools() {
  const [text, setText] = useState("");
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim()).length;
  return (
    <div className="space-y-2">
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="Paste text to analyse"
        className="w-full rounded-lg border border-line bg-paper px-2 py-1.5 text-xs outline-none text-ink" />
      <div className="grid grid-cols-3 gap-1.5 text-center text-xs">
        {[["Words", words], ["Chars", chars], ["Sentences", sentences]].map(([l, v]) => (
          <div key={l} className="rounded-lg bg-paper border border-line p-1.5">
            <div className="font-bold text-ink">{v}</div>
            <div className="text-[10px] text-soft">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Coordinate grid ---------- */
function CoordinateGrid() {
  const [pt, setPt] = useState<{ x: number; y: number } | null>(null);
  return (
    <div>
      <svg viewBox="0 0 260 260" className="w-full rounded-lg bg-paper border border-line cursor-crosshair"
        onClick={(e) => {
          const r = (e.target as SVGElement).closest("svg")!.getBoundingClientRect();
          setPt({ x: Math.round(((e.clientX - r.left) / r.width) * 10), y: Math.round(10 - ((e.clientY - r.top) / r.height) * 10) });
        }}>
        {Array.from({ length: 11 }, (_, i) => (
          <g key={i} stroke="var(--line)" strokeWidth={0.5}>
            <line x1={i * 26} y1={0} x2={i * 26} y2={260} />
            <line x1={0} y1={i * 26} x2={260} y2={i * 26} />
          </g>
        ))}
        {pt && <circle cx={pt.x * 26} cy={(10 - pt.y) * 26} r={5} fill="var(--teal)" />}
      </svg>
      <p className="text-[10px] text-soft mt-1">
        {pt ? `Grid reference: (${pt.x}, ${pt.y})` : "Click the grid to read a coordinate, 10 by 10"}
      </p>
    </div>
  );
}
