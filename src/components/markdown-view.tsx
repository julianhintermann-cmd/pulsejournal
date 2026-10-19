import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

export function MarkdownView({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value?.trim()) return null;
  return (
    <div className={cn("markdown", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer noopener">
              {children}
            </a>
          ),
          img: ({ alt }) => <span className="text-muted-foreground">[{alt || "Bild"}]</span>,
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}
