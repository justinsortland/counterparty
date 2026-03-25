"use client";

import { useRef } from "react";

export function LabelSelect({
  name,
  defaultValue,
  className,
  children,
}: {
  name: string;
  defaultValue: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLSelectElement>(null);

  return (
    <select
      ref={ref}
      name={name}
      defaultValue={defaultValue}
      className={className}
      onChange={() => ref.current?.form?.requestSubmit()}
    >
      {children}
    </select>
  );
}
