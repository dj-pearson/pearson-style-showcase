import { cn } from '@/lib/utils';

interface ToggleChipsProps {
  /** Accessible name for the group, e.g. "Tracks". */
  label: string;
  options: readonly string[];
  labels: Record<string, string>;
  selected: string[];
  onChange: (next: string[]) => void;
  /** Single-select: picking one option replaces the selection. */
  single?: boolean;
}

/**
 * A row of pressable chips for picking tracks, products or kinds. Buttons with
 * aria-pressed rather than a dropdown so tagging a story takes one tap each on
 * a phone.
 */
export const ToggleChips = ({
  label,
  options,
  labels,
  selected,
  onChange,
  single = false,
}: ToggleChipsProps) => {
  const toggle = (option: string) => {
    const isOn = selected.includes(option);
    if (single) {
      onChange(isOn ? [] : [option]);
      return;
    }
    onChange(isOn ? selected.filter((s) => s !== option) : [...selected, option]);
  };

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const isOn = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            aria-pressed={isOn}
            onClick={() => toggle(option)}
            className={cn(
              'min-h-[44px] rounded-md border px-3 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              isOn
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground'
            )}
          >
            {labels[option] ?? option}
          </button>
        );
      })}
    </div>
  );
};
