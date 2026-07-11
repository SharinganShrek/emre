import { z } from "zod";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Habit log update from the AI assistant. */
export const habitLogInput = z.object({
  habit_id: z.string().min(1),
  log_date: isoDate.optional(),
  completed: z.boolean(),
  note: z.string().max(500).optional(),
});
export type HabitLogInput = z.infer<typeof habitLogInput>;

export const taskInput = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional(),
  status: z.enum(["todo", "in_progress", "done"]).default("todo"),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  due_date: isoDate.optional(),
  project: z.string().max(100).optional(),
});
export type TaskInput = z.infer<typeof taskInput>;

export const movieInput = z.object({
  title: z.string().min(1).max(200),
  kind: z.enum(["anime", "movie", "series"]).default("anime"),
  status: z.enum(["planned", "watching", "watched"]).default("planned"),
  rating: z.number().min(0).max(10).optional(),
  review: z.string().max(2000).optional(),
  watched_date: isoDate.optional(),
});
export type MovieInput = z.infer<typeof movieInput>;

export const journalInput = z.object({
  entry_date: isoDate.optional(),
  mood: z.number().int().min(1).max(5),
  content: z.string().min(1).max(5000),
});
export type JournalInput = z.infer<typeof journalInput>;

export const noteInput = z.object({
  title: z.string().min(1).max(200),
  body: z.string().max(20000).default(""),
  tags: z.array(z.string().max(40)).default([]),
  category: z.enum(["idea", "project", "quote", "note"]).default("note"),
});
export type NoteInput = z.infer<typeof noteInput>;
