"use client";

import { TagSuggestInput } from "@/app/components/tag-suggest-input";

/** Tag filter input with a clickable list of tags in scope. */
export function TagFilterField({
  tags,
  name = "tag",
  defaultValue = "",
  className,
}: {
  tags: string[];
  name?: string;
  defaultValue?: string;
  className?: string;
}) {
  return (
    <TagSuggestInput
      tags={tags}
      name={name}
      defaultValue={defaultValue}
      className={className}
      placeholder="Tag filter"
      inputClassName="tide-input w-36"
      emptyMessage="No tags in this folder yet"
      submitOnPick
      clearOptionLabel="Clear tag filter"
    />
  );
}
