import { Clock3 } from "lucide-react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className="brand" href="/" aria-label="IntentHour home">
      <span className="brand-mark" aria-hidden="true">
        <Clock3 size={compact ? 18 : 22} strokeWidth={1.7} />
      </span>
      <span>IntentHour</span>
    </a>
  );
}
