"use client";

import { Camera, GripVertical, ImagePlus, Images, Trash2, Upload } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type UploaderItem = {
  key: string;
  /** Id of an already stored screenshot; undefined for a pending upload. */
  id?: string;
  file?: File;
  previewUrl: string;
  caption: string;
};

const MAX_BYTES = 15 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

let keySeq = 0;

/** Turns picked / dropped / pasted files into pending uploader items (validates type and size). */
export function filesToItems(files: Iterable<File>): UploaderItem[] {
  const items: UploaderItem[] = [];
  for (const file of files) {
    if (!file.type.startsWith("image/")) continue;
    if (file.size > MAX_BYTES) {
      toast.error(`${file.name || "Bild"} ist grösser als 15 MB.`);
      continue;
    }
    keySeq += 1;
    items.push({ key: `new-${Date.now()}-${keySeq}`, file, previewUrl: URL.createObjectURL(file), caption: "" });
  }
  return items;
}

function Row({
  item,
  onCaption,
  onRemove,
}: {
  item: UploaderItem;
  onCaption: (caption: string) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-3 rounded-[12px] border border-border bg-surface-2 p-2"
    >
      <button
        type="button"
        aria-label="Verschieben"
        className="flex h-16 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-faint active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical className="size-4" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element -- local blob / auth-protected previews */}
      <img src={item.previewUrl} alt="" className="h-16 w-24 shrink-0 rounded-[8px] bg-surface-3 object-cover" />
      <input
        value={item.caption}
        onChange={(e) => onCaption(e.target.value)}
        placeholder="Beschriftung"
        maxLength={300}
        aria-label="Beschriftung"
        className="h-10 min-w-0 flex-1 rounded-[8px] border border-transparent bg-transparent px-2 text-base outline-none placeholder:text-faint focus:border-border focus:bg-surface md:text-[14px]"
      />
      {!item.id ? <span className="hidden shrink-0 text-small text-accent sm:inline">Neu</span> : null}
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Entfernen" onClick={onRemove}>
        <Trash2 />
      </Button>
    </Reorder.Item>
  );
}

export function ScreenshotUploader({
  items,
  onChange,
}: {
  items: UploaderItem[];
  onChange: (items: UploaderItem[]) => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const add = (files: FileList | null) => {
    if (!files) return;
    const next = filesToItems(Array.from(files));
    if (next.length > 0) onChange([...items, ...next]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          add(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center justify-center gap-3 rounded-[12px] border border-dashed px-4 py-6 text-center transition-colors",
          dragOver ? "border-accent bg-accent-soft" : "border-border",
        )}
      >
        <ImagePlus className="size-8 text-faint" strokeWidth={1.5} />
        <p className="hidden text-body text-muted-foreground md:block">
          Bilder hierher ziehen oder mit <kbd className="font-sans font-semibold">Ctrl/⌘ + V</kbd> einfügen
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="md:hidden"
            onClick={() => cameraRef.current?.click()}
          >
            <Camera /> Foto aufnehmen
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="md:hidden"
            onClick={() => fileRef.current?.click()}
          >
            <Images /> Aus Galerie
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="hidden md:inline-flex"
            onClick={() => fileRef.current?.click()}
          >
            <Upload /> Dateien wählen
          </Button>
        </div>
        <p className="text-small text-faint">JPEG, PNG, WebP oder HEIC · max. 15 MB pro Bild</p>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => {
            add(e.target.files);
            e.target.value = "";
          }}
        />
      </div>
      {items.length > 0 ? (
        <Reorder.Group axis="y" values={items} onReorder={onChange} className="flex flex-col gap-2">
          {items.map((item) => (
            <Row
              key={item.key}
              item={item}
              onCaption={(caption) => onChange(items.map((i) => (i.key === item.key ? { ...i, caption } : i)))}
              onRemove={() => {
                if (item.file) URL.revokeObjectURL(item.previewUrl);
                onChange(items.filter((i) => i.key !== item.key));
              }}
            />
          ))}
        </Reorder.Group>
      ) : null}
    </div>
  );
}
