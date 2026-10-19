"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { haptic } from "@/lib/ios/haptics";
import { cn } from "@/lib/utils";

/**
 * iOS 26 segmented control: the selected segment sits on a glass thumb that slides with a spring (only
 * `transform`); a change plays the selection haptic.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  className,
  thumbClassName,
}: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  className?: string;
  /** e.g. a profit/loss tint for Long/Short. */
  thumbClassName?: string;
}) {
  const index = options.findIndex((o) => o.value === value);
  return (
    <div role="radiogroup" aria-label={label} className={cn("ios-segmented", className)}>
      {index >= 0 ? (
        <span
          aria-hidden="true"
          className={cn("glass ios-segmented__thumb", thumbClassName)}
          style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        />
      ) : null}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => {
            if (option.value === value) return;
            haptic("selection");
            onChange(option.value);
          }}
          className={cn("ios-segmented__item", option.value === value && "ios-segmented__item--active")}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

const DIGITS = "0123456789";

/**
 * Rolling digits like SwiftUI `.numericText()`: each digit is a column that slides to its new value when the text
 * changes; other characters swap instantly. Screen readers get the plain text.
 */
export function NumberRoll({ value, className }: { value: string; className?: string }) {
  const [rolled, setRolled] = useState(false);
  const previous = useRef(value);
  useLayoutEffect(() => {
    if (previous.current !== value) {
      previous.current = value;
      setRolled(true);
    }
  }, [value]);
  const chars = [...value];
  return (
    <span className={cn("ios-roll", className)}>
      <span className="sr-only">{value}</span>
      <span aria-hidden="true" className="ios-roll__visual">
        {chars.map((char, i) => {
          const digit = DIGITS.indexOf(char);
          // Key by position from the right so units stay in place when the number grows.
          const key = chars.length - i;
          if (digit < 0) {
            return (
              <span key={`c${key}`} className="ios-roll__char">
                {char}
              </span>
            );
          }
          return (
            <span key={`d${key}`} className="ios-roll__digit">
              <span
                className={cn("ios-roll__column", rolled && "ios-roll__column--animated")}
                style={{ transform: `translateY(${-digit * 10}%)` }}
              >
                {DIGITS.split("").map((d) => (
                  <span key={d}>{d}</span>
                ))}
              </span>
              <span className="invisible">0</span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
