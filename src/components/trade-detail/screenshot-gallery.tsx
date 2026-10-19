"use client";

import { Expand } from "lucide-react";
import { useState } from "react";

import { Lightbox } from "@/components/lightbox";
import { uploadUrl } from "@/lib/upload-url";
import { cn } from "@/lib/utils";

export type GalleryShot = {
  id: string;
  filePath: string;
  thumbPath: string;
  width: number;
  height: number;
  caption: string | null;
};

/** First image large, the others as thumbnails; tap opens the lightbox. */
export function ScreenshotGallery({ shots, className }: { shots: GalleryShot[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  if (shots.length === 0) return null;
  const [first, ...rest] = shots;
  const show = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  return (
    <>
      <PhoneCarousel shots={shots} onOpen={show} className="md:hidden" />
      <div className={cn("flex flex-col gap-2 max-md:hidden", className)}>
        <button
          type="button"
          onClick={() => show(0)}
          className="group relative overflow-hidden rounded-[12px] border border-border bg-surface-2"
          style={{ aspectRatio: `${first.width} / ${first.height}`, maxHeight: 520 }}
          aria-label="Screenshot vergrössern"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected upload served by the API route */}
          <img
            src={uploadUrl(first.filePath)}
            alt={first.caption ?? "Screenshot"}
            className="size-full object-contain"
          />
          <span className="absolute top-2 right-2 inline-flex size-8 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">
            <Expand className="size-4" />
          </span>
          {first.caption ? (
            <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 pt-6 pb-2 text-left text-small text-white">
              {first.caption}
            </span>
          ) : null}
        </button>
        {rest.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {rest.map((shot, i) => (
              <button
                key={shot.id}
                type="button"
                onClick={() => show(i + 1)}
                className="aspect-[4/3] overflow-hidden rounded-[10px] border border-border bg-surface-2"
                aria-label={`Screenshot ${i + 2} öffnen`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected upload served by the API route */}
                <img
                  src={uploadUrl(shot.thumbPath)}
                  alt={shot.caption ?? ""}
                  loading="lazy"
                  className="size-full object-cover"
                />
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <Lightbox
        open={open}
        onOpenChange={setOpen}
        index={index}
        onIndexChange={setIndex}
        images={shots.map((s) => ({
          src: uploadUrl(s.filePath),
          caption: s.caption,
          width: s.width,
          height: s.height,
        }))}
      />
    </>
  );
}

/** Phones: horizontal scroll-snap carousel with page dots (native momentum). */
function PhoneCarousel({
  shots,
  onOpen,
  className,
}: {
  shots: GalleryShot[];
  onOpen: (index: number) => void;
  className?: string;
}) {
  const [page, setPage] = useState(0);
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div
        data-no-swipe-back
        className="ios-hscroll flex snap-x snap-mandatory gap-2 rounded-[18px]"
        onScroll={(e) => {
          const el = e.currentTarget;
          setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {shots.map((shot, i) => (
          <button
            key={shot.id}
            type="button"
            onClick={() => onOpen(i)}
            className="relative w-full shrink-0 snap-center overflow-hidden rounded-[18px] bg-surface-2"
            style={{ aspectRatio: `${shot.width} / ${shot.height}`, maxHeight: 420 }}
            aria-label={`Screenshot ${i + 1} von ${shots.length} öffnen`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- auth-protected upload served by the API route */}
            <img
              src={uploadUrl(i === 0 ? shot.filePath : shot.thumbPath)}
              alt={shot.caption ?? "Screenshot"}
              loading={i === 0 ? undefined : "lazy"}
              draggable={false}
              className="size-full object-cover"
            />
          </button>
        ))}
      </div>
      {shots.length > 1 ? (
        <div className="flex justify-center gap-1.5" aria-hidden="true">
          {shots.map((shot, i) => (
            <span
              key={shot.id}
              className={cn(
                "size-[7px] rounded-full transition-colors",
                i === page ? "bg-foreground" : "bg-[var(--ios-label-3)]",
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
