"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";

import { ScreenshotUploader, type UploaderItem } from "@/components/screenshot-uploader";
import {
  deleteScreenshot,
  reorderScreenshots,
  updateScreenshotCaption,
  uploadScreenshot,
} from "@/server/actions/screenshots";

/** Journal-day screenshots: every change (upload, delete, caption, order) is saved immediately. */
export function JournalScreenshots({ date, initial }: { date: string; initial: UploaderItem[] }) {
  const [items, setItems] = useState(initial);
  const captionTimers = useRef(new Map<string, number>());

  const onChange = async (next: UploaderItem[]) => {
    const previous = items;
    setItems(next);

    const removed = previous.filter((p) => p.id && !next.some((n) => n.id === p.id));
    for (const r of removed) {
      const result = await deleteScreenshot(r.id!);
      if (!result.ok) toast.error(result.error);
    }

    for (const item of next) {
      const before = previous.find((p) => p.key === item.key);
      if (item.id && before && before.caption !== item.caption) {
        const id = item.id;
        window.clearTimeout(captionTimers.current.get(id));
        captionTimers.current.set(
          id,
          window.setTimeout(() => {
            void updateScreenshotCaption(id, item.caption);
          }, 800),
        );
      }
    }

    const added = next.filter((n) => n.file && !n.id);
    for (const item of added) {
      const fd = new FormData();
      fd.set("file", item.file!);
      fd.set("journalDate", date);
      fd.set("caption", item.caption);
      const result = await uploadScreenshot(fd);
      if (!result.ok) {
        toast.error(result.error);
        setItems((list) => list.filter((i) => i.key !== item.key));
        continue;
      }
      setItems((list) => list.map((i) => (i.key === item.key ? { ...i, id: result.data.id, file: undefined } : i)));
    }

    const order = next.filter((n) => n.id).map((n) => n.id!);
    const prevOrder = previous.filter((p) => p.id && order.includes(p.id)).map((p) => p.id!);
    if (order.length > 1 && order.join() !== prevOrder.join() && removed.length === 0 && added.length === 0) {
      await reorderScreenshots(order);
    }
  };

  return <ScreenshotUploader items={items} onChange={(next) => void onChange(next)} />;
}
