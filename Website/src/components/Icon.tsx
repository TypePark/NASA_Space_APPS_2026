import { ICON } from "../content";
import type { IconName } from "../content";

interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  /** Text for screen readers. Leave out for decorative icons. */
  label?: string;
  className?: string;
}

export default function Icon({ name, size = 20, strokeWidth = 1.8, label, className }: IconProps) {
  return (
    <svg
      className={className ? `icon ${className}` : "icon"}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <path d={ICON[name]} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
