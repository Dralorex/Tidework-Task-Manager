"use client";

import { useState } from "react";

/** Priority select that shows muted hint text until a level is chosen. */
export function PriorityField({
  name = "priority",
  defaultValue = "",
  required = true,
  className,
}: {
  name?: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const isHint = !value;

  return (
    <select
      name={name}
      required={required}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      aria-label="Priority Level"
      className={`tide-input ${isHint ? "tide-input-hint" : ""} ${className ?? ""}`}
    >
      <option value="" disabled>
        Priority Level
      </option>
      <option value="CRITICAL">Critical</option>
      <option value="HIGH">High</option>
      <option value="MEDIUM">Medium</option>
      <option value="LOW">Low</option>
    </select>
  );
}
