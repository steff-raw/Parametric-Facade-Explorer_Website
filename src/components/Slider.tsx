"use client";

import { PatternParamDef } from "@/lib/patterns";

interface SliderProps {
  def: PatternParamDef;
  value: number;
  onChange: (key: string, value: number) => void;
}

function formatValue(
  value: number,
  def: PatternParamDef
): string {
  if (def.format) return def.format(value);
  if (def.options && def.options.length > 0) {
    const idx = Math.round(value) - Math.round(def.min);
    return def.options[idx] ?? String(Math.round(value));
  }
  const decimals =
    def.step < 1 ? String(def.step).split(".")[1]?.length ?? 1 : 0;
  const num =
    decimals > 0 ? value.toFixed(decimals) : String(Math.round(value));
  return def.unit ? `${num} ${def.unit}` : num;
}

export default function Slider({ def, value, onChange }: SliderProps) {
  const isDiscrete = Boolean(def.options?.length);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label
          htmlFor={`param-${def.key}`}
          className="text-sm font-medium text-ink"
        >
          {def.label}
        </label>
        <span className="text-xs text-muted tabular-nums">
          {formatValue(value, def)}
        </span>
      </div>
      <input
        id={`param-${def.key}`}
        className="pfe-slider"
        type="range"
        min={def.min}
        max={def.max}
        step={def.step}
        value={value}
        onChange={(e) => onChange(def.key, Number(e.target.value))}
        aria-valuemin={def.min}
        aria-valuemax={def.max}
        aria-valuenow={value}
        aria-valuetext={formatValue(value, def)}
      />
      {isDiscrete && def.options && (
        <div className="mt-1.5 flex justify-between gap-1">
          {def.options.map((opt, i) => {
            const optVal = def.min + i * def.step;
            const active = Math.round(value) === Math.round(optVal);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onChange(def.key, optVal)}
                className={[
                  "text-[10px] uppercase tracking-tag transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink",
                ].join(" ")}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
