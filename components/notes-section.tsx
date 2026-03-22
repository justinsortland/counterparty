"use client";

import { useActionState, useState } from "react";
import { createNote, type CreateNoteState } from "@/lib/actions/notes";
import { cn } from "@/lib/utils";

const NOTE_TYPE_OPTIONS = [
  { value: "MEETING", label: "Meeting" },
  { value: "CALL", label: "Call" },
  { value: "EMAIL", label: "Email" },
  { value: "MESSAGE", label: "Message" },
  { value: "OTHER", label: "Other" },
];

const NOTE_TYPE_LABELS: Record<string, string> = {
  MEETING: "Meeting",
  CALL: "Call",
  EMAIL: "Email",
  MESSAGE: "Message",
  OTHER: "Other",
};

const inputClass =
  "w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-100 bg-white placeholder:text-zinc-400";

const labelClass = "block text-sm font-medium text-zinc-700 mb-1";

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

function formatNoteDate(isoDate: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(isoDate));
}

type Note = {
  id: string;
  type: string;
  date: string;
  body: string;
  createdAt: string;
};

function NoteTimeline({ notes }: { notes: Note[] }) {
  if (notes.length === 0) {
    return <p className="py-6 text-sm text-zinc-400">No notes yet.</p>;
  }

  return (
    <div className="divide-y divide-zinc-100">
      {notes.map((note) => (
        <div key={note.id} className="py-4">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="inline-flex items-center rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600">
              {NOTE_TYPE_LABELS[note.type] ?? note.type}
            </span>
            <span className="text-xs text-zinc-400">{formatNoteDate(note.date)}</span>
          </div>
          <p className="text-sm text-zinc-700 whitespace-pre-wrap">{note.body}</p>
        </div>
      ))}
    </div>
  );
}

function AddNoteForm({
  counterpartyId,
  dealId,
  redirectTo,
}: {
  counterpartyId: string;
  dealId?: string;
  redirectTo: string;
}) {
  const today = new Date().toISOString().split("T")[0];
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<CreateNoteState, FormData>(
    createNote,
    null
  );

  const errors = state?.errors ?? {};

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-zinc-400 hover:text-zinc-600"
      >
        + Add note
      </button>
    );
  }

  return (
    <form action={formAction} className="border-t border-zinc-100 pt-4 pb-2 space-y-3">
      <input type="hidden" name="counterpartyId" value={counterpartyId} />
      {dealId && <input type="hidden" name="dealId" value={dealId} />}
      <input type="hidden" name="redirectTo" value={redirectTo} />

      {errors.form && (
        <p className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errors.form}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="note-type" className={labelClass}>
            Type <span className="text-red-500">*</span>
          </label>
          <select
            id="note-type"
            name="type"
            defaultValue="MEETING"
            className={cn(
              inputClass,
              errors.type && "border-red-300 focus:border-red-400 focus:ring-red-100"
            )}
          >
            {NOTE_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <FieldError message={errors.type} />
        </div>

        <div>
          <label htmlFor="note-date" className={labelClass}>
            Date <span className="text-red-500">*</span>
          </label>
          <input
            id="note-date"
            name="date"
            type="date"
            defaultValue={today}
            className={cn(
              inputClass,
              errors.date && "border-red-300 focus:border-red-400 focus:ring-red-100"
            )}
          />
          <FieldError message={errors.date} />
        </div>
      </div>

      <div>
        <label htmlFor="note-body" className={labelClass}>
          Note <span className="text-red-500">*</span>
        </label>
        <textarea
          id="note-body"
          name="body"
          rows={4}
          placeholder="What happened?"
          className={cn(
            inputClass,
            "resize-none",
            errors.body && "border-red-300 focus:border-red-400 focus:ring-red-100"
          )}
        />
        <FieldError message={errors.body} />
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-zinc-400 hover:text-zinc-600"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-700 disabled:opacity-50"
        >
          {isPending ? "Saving…" : "Save note"}
        </button>
      </div>
    </form>
  );
}

export function NotesSection({
  notes,
  counterpartyId,
  dealId,
  redirectTo,
}: {
  notes: Note[];
  counterpartyId: string;
  dealId?: string;
  redirectTo: string;
}) {
  return (
    <div>
      <NoteTimeline notes={notes} />
      <AddNoteForm
        counterpartyId={counterpartyId}
        dealId={dealId}
        redirectTo={redirectTo}
      />
    </div>
  );
}
