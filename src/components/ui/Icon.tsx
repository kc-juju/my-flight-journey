interface IconProps {
  name: string;
  className?: string;
  filled?: boolean;
  /** Decorative by default; pass a label when the icon carries meaning alone. */
  label?: string;
}

export function Icon({ name, className = '', filled = false, label }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined ${filled ? 'icon-filled' : ''} ${className}`}
      aria-hidden={label ? undefined : true}
      role={label ? 'img' : undefined}
      aria-label={label}
    >
      {name}
    </span>
  );
}
