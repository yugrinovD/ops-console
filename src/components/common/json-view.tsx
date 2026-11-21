import { safeJson } from "@/lib/utils";
import { CopyButton } from "./copy-button";

export function JsonView({
  value,
  className,
  maxHeight = "24rem",
}: {
  value: unknown;
  className?: string;
  maxHeight?: string;
}) {
  const text = safeJson(value);
  return (
    <div className={className}>
      <div className="relative">
        <div className="absolute right-2 top-2 z-10">
          <CopyButton value={text} />
        </div>
        <pre
          className="overflow-auto rounded-lg border border-border bg-[#0b0d10] p-4 font-mono text-[11px] leading-relaxed text-white/75"
          style={{ maxHeight }}
        >
          {text}
        </pre>
      </div>
    </div>
  );
}
