import { cn } from "@/lib/utils";

type PillSelectorProps<T extends string> = {
  label: string;
  options: readonly T[];
  value: T | "";
  onChange: (value: T) => void;
};

export function PillSelector<T extends string>({
  label,
  options,
  value,
  onChange,
}: PillSelectorProps<T>) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-gray-700">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              value === opt
                ? "border-[#7c1d5c] bg-[#7c1d5c] text-white"
                : "border-gray-200 bg-white text-gray-700 hover:border-[#7c1d5c]/40"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}
