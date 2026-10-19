"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { GripVertical, Loader2, Plus, Trash2 } from "lucide-react";
import { Reorder, useDragControls } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { ColorPicker } from "@/components/color-picker";
import { FormField } from "@/components/form-field";
import { MarkdownEditor } from "@/components/markdown-editor";
import { ResponsiveDialog } from "@/components/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PALETTE, playbookFormSchema, type PlaybookFormValues } from "@/lib/validation";
import { savePlaybook } from "@/server/actions/playbooks";

export type EditablePlaybook = {
  id: string;
  name: string;
  color: string;
  description: string | null;
  rules: { id: string; text: string }[];
};

type RuleItem = { key: string; id: string | null; text: string };

let seq = 0;
const newKey = () => `rule-${Date.now()}-${++seq}`;

function RuleRow({
  item,
  onChange,
  onRemove,
}: {
  item: RuleItem;
  onChange: (text: string) => void;
  onRemove: () => void;
}) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      className="flex items-center gap-2 rounded-[10px] bg-surface-2 py-1 pr-1 pl-1"
    >
      <button
        type="button"
        aria-label="Regel verschieben"
        className="flex h-9 w-7 shrink-0 cursor-grab touch-none items-center justify-center text-faint active:cursor-grabbing"
        onPointerDown={(e) => controls.start(e)}
      >
        <GripVertical className="size-4" />
      </button>
      <input
        value={item.text}
        onChange={(e) => onChange(e.target.value)}
        maxLength={300}
        aria-label="Regel"
        className="h-9 min-w-0 flex-1 bg-transparent text-base outline-none md:text-[14px]"
      />
      <Button type="button" variant="ghost" size="icon-sm" aria-label="Regel entfernen" onClick={onRemove}>
        <Trash2 />
      </Button>
    </Reorder.Item>
  );
}

export function PlaybookFormDialog({
  open,
  onOpenChange,
  playbook,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playbook: EditablePlaybook | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rules, setRules] = useState<RuleItem[]>([]);
  const [newRule, setNewRule] = useState("");
  const form = useForm<PlaybookFormValues>({
    resolver: zodResolver(playbookFormSchema),
    defaultValues: { name: "", color: PALETTE[0], description: "" },
  });
  const { errors } = form.formState;

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: playbook?.name ?? "",
      color: playbook?.color ?? PALETTE[0],
      description: playbook?.description ?? "",
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset local rule list whenever the dialog opens
    setRules((playbook?.rules ?? []).map((r) => ({ key: r.id, id: r.id, text: r.text })));
    setNewRule("");
  }, [open, playbook, form]);

  const addRule = () => {
    const text = newRule.trim();
    if (!text) return;
    setRules((list) => [...list, { key: newKey(), id: null, text }]);
    setNewRule("");
  };

  const onSubmit = form.handleSubmit((values) => {
    const cleanRules = rules.map((r) => ({ id: r.id, text: r.text.trim() })).filter((r) => r.text);
    startTransition(async () => {
      const result = await savePlaybook(playbook?.id ?? null, { ...values, rules: cleanRules });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(playbook ? "Playbook gespeichert" : "Playbook angelegt");
      onOpenChange(false);
      if (!playbook) router.push(`/playbooks/${result.data.id}`);
    });
  });

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={playbook ? "Playbook bearbeiten" : "Neues Playbook"}
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={onSubmit} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            Speichern
          </Button>
        </>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4 pb-1" noValidate>
        <FormField label="Name" htmlFor="pb-name" error={errors.name?.message}>
          <Input id="pb-name" aria-invalid={!!errors.name} {...form.register("name")} />
        </FormField>
        <FormField label="Farbe">
          <Controller
            control={form.control}
            name="color"
            render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
          />
        </FormField>
        <FormField label="Beschreibung" htmlFor="pb-description">
          <Controller
            control={form.control}
            name="description"
            render={({ field }) => (
              <MarkdownEditor
                id="pb-description"
                value={field.value}
                onChange={field.onChange}
                placeholder="Wann und wie handelst du dieses Setup?"
                minRows={4}
              />
            )}
          />
        </FormField>
        <FormField label={`Regeln (${rules.length})`}>
          <div className="flex flex-col gap-2">
            {rules.length > 0 ? (
              <Reorder.Group axis="y" values={rules} onReorder={setRules} className="flex flex-col gap-1.5">
                {rules.map((rule) => (
                  <RuleRow
                    key={rule.key}
                    item={rule}
                    onChange={(text) => setRules((list) => list.map((r) => (r.key === rule.key ? { ...r, text } : r)))}
                    onRemove={() => setRules((list) => list.filter((r) => r.key !== rule.key))}
                  />
                ))}
              </Reorder.Group>
            ) : null}
            <div className="flex gap-2">
              <Input
                value={newRule}
                onChange={(e) => setNewRule(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRule();
                  }
                }}
                placeholder="Neue Regel, z. B. „Stop hinter dem Level“"
                maxLength={300}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={addRule}
                disabled={!newRule.trim()}
                aria-label="Regel hinzufügen"
              >
                <Plus />
              </Button>
            </div>
          </div>
        </FormField>
      </form>
    </ResponsiveDialog>
  );
}
