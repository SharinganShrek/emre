import "server-only";
import { isHubSyncConfigured } from "@/lib/access";
import { CatalogError } from "@/lib/catalog/http";
import { getGoogleBook, searchGoogleBooks } from "@/lib/catalog/google-books";
import { getMalAnime, getMalManga, searchMalAnime, searchMalManga } from "@/lib/catalog/mal";
import {
  getTmdbMovie,
  getTmdbShow,
  searchTmdbMovies,
  searchTmdbShows,
} from "@/lib/catalog/tmdb";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  SHARE_NOT_READY,
  SUPABASE_NOT_READY,
  dueFrom,
  exchangeUnavailable,
  fromAnime,
  fromBook,
  fromFilm,
  fromManga,
  fromShow,
  friendBaseUrl,
  isShareImage,
  isSourceId,
  shareMediaSchema,
  type ExchangeState,
  type ShareHit,
  type ShareItem,
  type ShareKind,
  type ShareMedia,
} from "@/lib/media-share";

export class ShareError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly remoteStatus: number | null = null,
  ) {
    super(message);
    this.name = "ShareError";
  }
}

export class MissingShareTableError extends Error {
  constructor() {
    super(SHARE_NOT_READY);
    this.name = "MissingShareTableError";
  }
}

export function exchangeErrorStatus(
  error: unknown,
): { status: number; error: string } | null {
  if (error instanceof ShareError) return { status: error.status, error: error.message };
  if (error instanceof MissingShareTableError) {
    return { status: 503, error: SHARE_NOT_READY };
  }
  return null;
}

function catalogueError(error: unknown): ShareError | null {
  if (error instanceof CatalogError) return new ShareError(error.message, error.status);
  if (error instanceof ShareError) return error;
  return null;
}

export interface FriendConfig {
  url: string;
  name: string;
  token: string;
}

export function friendConfig(): FriendConfig | null {
  const url = friendBaseUrl(process.env.FRIEND_SITE_URL);
  const token = process.env.EXCHANGE_TOKEN?.trim();
  if (!url || !token || token.length < 32) return null;
  const name =
    process.env.FRIEND_NAME?.trim().slice(0, 40) ||
    new URL(url).hostname.replace(/^www\./, "");
  return { url, name, token };
}

const FRIEND_TIMEOUT_MS = 10_000;

async function callFriend(
  friend: FriendConfig,
  path: string,
  body: unknown,
): Promise<Record<string, unknown>> {
  let res: Response;
  try {
    res = await fetch(`${friend.url}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${friend.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FRIEND_TIMEOUT_MS),
      redirect: "manual",
      cache: "no-store",
    });
  } catch {
    throw new ShareError(
      `Couldn't reach ${friend.name}'s site — try again in a minute.`,
      502,
    );
  }

  if (res.status === 0 || (res.status >= 300 && res.status < 400)) {
    throw new ShareError(
      `Couldn't reach ${friend.name}'s site — try again in a minute.`,
      502,
    );
  }

  const answer = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  if (res.status === 401) {
    throw new ShareError(
      `${friend.name}'s site refused the token — EXCHANGE_TOKEN must be the same on both sites.`,
      502,
    );
  }
  if (!res.ok || !answer) {
    const said =
      typeof answer?.error === "string" ? `: ${answer.error.slice(0, 200)}` : ".";
    throw new ShareError(
      `${friend.name}'s site answered ${res.status}${said}`,
      res.status === 409 ? 409 : 502,
      res.status,
    );
  }
  return answer;
}

type DbError = { code?: string; message?: string };

function isMissingTable(error: DbError): boolean {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    code === "PGRST204" ||
    (message.includes("media_share") &&
      (message.includes("does not exist") || message.includes("schema cache")))
  );
}

function raise(error: DbError | null): void {
  if (!error) return;
  if (isMissingTable(error)) throw new MissingShareTableError();
  const wrapped = new Error(error.message || "Database error");
  (wrapped as Error & { code?: string }).code = error.code;
  throw wrapped;
}

function db() {
  return createAdminClient();
}

type MediaShareRow = {
  id: string;
  direction: string;
  kind: string;
  title: string;
  media: unknown;
  note: string | null;
  sent_at: string;
  due_at: string;
  finished_at: string | null;
  notified_at: string | null;
};

function asRow(value: unknown): MediaShareRow | null {
  if (!value || typeof value !== "object") return null;
  return value as MediaShareRow;
}

function toItem(row: MediaShareRow): ShareItem | null {
  const media = shareMediaSchema.safeParse(row.media);
  if (!media.success) return null;
  const sentAt = new Date(row.sent_at);
  const dueAt = new Date(row.due_at);
  if (Number.isNaN(sentAt.getTime()) || Number.isNaN(dueAt.getTime())) return null;
  const finished = row.finished_at ? new Date(row.finished_at) : null;
  const notified = row.notified_at ? new Date(row.notified_at) : null;
  return {
    id: row.id,
    direction: row.direction === "sent" ? "sent" : "received",
    media: {
      ...media.data,
      image:
        media.data.image && isShareImage(media.data.image) ? media.data.image : null,
    },
    note: row.note,
    sentAt: sentAt.toISOString(),
    dueAt: dueAt.toISOString(),
    finishedAt: finished && !Number.isNaN(finished.getTime()) ? finished.toISOString() : null,
    notifiedAt: notified && !Number.isNaN(notified.getTime()) ? notified.toISOString() : null,
  };
}

async function latest(direction: "sent" | "received"): Promise<ShareItem | null> {
  const { data, error } = await db()
    .from("media_share")
    .select("*")
    .eq("direction", direction)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  raise(error);
  const row = asRow(data);
  return row ? toItem(row) : null;
}

async function openOne(direction: "sent" | "received"): Promise<MediaShareRow | null> {
  const { data, error } = await db()
    .from("media_share")
    .select("*")
    .eq("direction", direction)
    .is("finished_at", null)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  raise(error);
  return asRow(data);
}

async function byId(id: string): Promise<MediaShareRow | null> {
  const { data, error } = await db()
    .from("media_share")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  raise(error);
  return asRow(data);
}

function requireDb(): void {
  if (!isHubSyncConfigured()) throw new ShareError(SUPABASE_NOT_READY, 503);
}

export async function exchangeState(): Promise<ExchangeState> {
  const now = new Date().toISOString();
  if (!isHubSyncConfigured()) return exchangeUnavailable(SUPABASE_NOT_READY, now);
  const friend = friendConfig();
  try {
    const [sent, received] = await Promise.all([latest("sent"), latest("received")]);
    return {
      ready: true,
      message: null,
      friend: friend ? { name: friend.name } : null,
      sent,
      received,
      now,
    };
  } catch (error) {
    if (error instanceof MissingShareTableError) {
      return exchangeUnavailable(SHARE_NOT_READY, now);
    }
    throw error;
  }
}

export async function searchKind(kind: ShareKind, query: string): Promise<ShareHit[]> {
  try {
    switch (kind) {
      case "movie":
        return (await searchTmdbMovies(query)).map((film) => ({
          sourceId: String(film.id),
          title: film.title,
          altTitle: null,
          year: film.year,
          image: film.poster,
          meta: null,
        }));
      case "tv":
        return (await searchTmdbShows(query)).map((show) => ({
          sourceId: String(show.id),
          title: show.name,
          altTitle: null,
          year: show.year,
          image: show.poster,
          meta: null,
        }));
      case "anime":
        return (await searchMalAnime(query)).map((entry) => {
          const media = fromAnime(entry);
          return {
            sourceId: media.sourceId,
            title: media.title,
            altTitle: media.altTitle,
            year: media.year,
            image: media.image,
            meta: media.lengthLabel,
          };
        });
      case "manga":
        return (await searchMalManga(query)).map((entry) => {
          const media = fromManga(entry);
          return {
            sourceId: media.sourceId,
            title: media.title,
            altTitle: media.altTitle,
            year: media.year,
            image: media.image,
            meta: media.lengthLabel,
          };
        });
      case "book":
        return (await searchGoogleBooks(query)).map((book) => {
          const media = fromBook(book);
          return {
            sourceId: media.sourceId,
            title: media.title,
            altTitle: null,
            year: media.year,
            image: media.image,
            meta: [media.creator, media.lengthLabel].filter(Boolean).join(" · ") || null,
          };
        });
    }
  } catch (error) {
    throw catalogueError(error) ?? error;
  }
}

export async function mediaDetails(kind: ShareKind, sourceId: string): Promise<ShareMedia> {
  if (!isSourceId(kind, sourceId)) {
    throw new ShareError("That isn't an id from the catalogue.", 400);
  }
  try {
    switch (kind) {
      case "movie":
        return acceptMedia(fromFilm(await getTmdbMovie(Number(sourceId))));
      case "tv":
        return acceptMedia(fromShow(await getTmdbShow(Number(sourceId))));
      case "anime":
        return acceptMedia(fromAnime(await getMalAnime(Number(sourceId))));
      case "manga":
        return acceptMedia(fromManga(await getMalManga(Number(sourceId))));
      case "book":
        return acceptMedia(fromBook(await getGoogleBook(sourceId)));
    }
  } catch (error) {
    if (error instanceof ShareError) throw error;
    const wrapped = catalogueError(error);
    if (wrapped) throw wrapped;
    throw error;
  }
}

function acceptMedia(media: ShareMedia): ShareMedia {
  const parsed = shareMediaSchema.safeParse({
    ...media,
    image: media.image && isShareImage(media.image) ? media.image : null,
  });
  if (!parsed.success) {
    throw new ShareError("That catalogue entry can't be sent.", 502);
  }
  return {
    ...parsed.data,
    image:
      parsed.data.image && isShareImage(parsed.data.image) ? parsed.data.image : null,
  };
}

export async function sendToFriend(
  kind: ShareKind,
  sourceId: string,
  note: string | null,
): Promise<ShareItem> {
  const friend = friendConfig();
  if (!friend) throw new ShareError("Set FRIEND_SITE_URL and EXCHANGE_TOKEN first.", 503);
  requireDb();

  const open = await openOne("sent");
  if (open) throw new ShareError(`${friend.name} hasn't finished ${open.title} yet.`, 409);

  const media = await mediaDetails(kind, sourceId);
  const id = crypto.randomUUID();
  const sentAt = new Date();
  const dueAt = dueFrom(sentAt, media.lengthMinutes);
  const { error } = await db()
    .from("media_share")
    .insert({
      id,
      direction: "sent",
      kind,
      title: media.title,
      media,
      note,
      sent_at: sentAt.toISOString(),
      due_at: dueAt.toISOString(),
    });
  if (error?.code === "23505") {
    const again = await openOne("sent");
    throw new ShareError(
      again
        ? `${friend.name} hasn't finished ${again.title} yet.`
        : `${friend.name} already has something open from you.`,
      409,
    );
  }
  raise(error);

  let answer: Record<string, unknown>;
  try {
    answer = await callFriend(friend, "/api/exchange/inbox", {
      id,
      sentAt: sentAt.toISOString(),
      note,
      media,
    });
  } catch (error) {
    await db().from("media_share").delete().eq("id", id);
    throw error;
  }

  const due = typeof answer.dueAt === "string" ? new Date(answer.dueAt) : null;
  if (!due || Number.isNaN(due.getTime())) {
    const row = await byId(id);
    const item = row ? toItem(row) : null;
    if (!item) throw new ShareError("The send was saved but couldn't be read back.", 500);
    return item;
  }

  const { data, error: updateError } = await db()
    .from("media_share")
    .update({ due_at: due.toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  raise(updateError);
  const item = asRow(data) ? toItem(asRow(data)!) : null;
  if (!item) throw new ShareError("The send was saved but couldn't be read back.", 500);
  return item;
}

export type InboxOutcome =
  | { ok: true; dueAt: string }
  | { ok: false; status: number; error: string };

export async function receive(body: {
  id: string;
  sentAt: string;
  note: string | null;
  media: ShareMedia;
}): Promise<InboxOutcome> {
  requireDb();
  const existing = await byId(body.id);
  if (existing) {
    return existing.direction === "received"
      ? { ok: true, dueAt: new Date(existing.due_at).toISOString() }
      : { ok: false, status: 409, error: "That id is already in use here." };
  }

  const open = await openOne("received");
  if (open) {
    return {
      ok: false,
      status: 409,
      error: `Still on ${open.title} — it can be sent once that's finished.`,
    };
  }

  const now = new Date();
  const sentAt = new Date(body.sentAt);
  const { data, error } = await db()
    .from("media_share")
    .insert({
      id: body.id,
      direction: "received",
      kind: body.media.kind,
      title: body.media.title,
      media: body.media,
      note: body.note,
      sent_at:
        Number.isNaN(sentAt.getTime()) || sentAt > now
          ? now.toISOString()
          : sentAt.toISOString(),
      due_at: dueFrom(now, body.media.lengthMinutes).toISOString(),
    })
    .select("due_at")
    .maybeSingle();

  if (error?.code === "23505") {
    const raced = await byId(body.id);
    if (raced?.direction === "received") {
      return { ok: true, dueAt: new Date(raced.due_at).toISOString() };
    }
    if (raced) return { ok: false, status: 409, error: "That id is already in use here." };
    const stillOpen = await openOne("received");
    if (stillOpen) {
      return {
        ok: false,
        status: 409,
        error: `Still on ${stillOpen.title} — it can be sent once that's finished.`,
      };
    }
    return {
      ok: false,
      status: 409,
      error: "Still on the last one — it can be sent once that's finished.",
    };
  }
  raise(error);
  const due = asStringDate(asRow(data)?.due_at ?? (data as { due_at?: string } | null)?.due_at);
  if (!due) throw new ShareError("The item was saved but had no deadline.", 500);
  return { ok: true, dueAt: due };
}

function asStringDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function finishReceived(id: string): Promise<ShareItem | null> {
  requireDb();
  const row = await byId(id);
  if (!row || row.direction !== "received") return null;

  let finished = row;
  if (!row.finished_at) {
    const { data, error } = await db()
      .from("media_share")
      .update({ finished_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .maybeSingle();
    raise(error);
    finished = asRow(data) ?? row;
  }
  if (finished.notified_at) return toItem(finished);

  const friend = friendConfig();
  if (!friend) return toItem(finished);
  const finishedAt = finished.finished_at ?? new Date().toISOString();
  try {
    await callFriend(friend, `/api/exchange/inbox/${encodeURIComponent(id)}/finished`, {
      finishedAt,
    });
  } catch (error) {
    if (!(error instanceof ShareError)) throw error;
    if (error.remoteStatus !== 404) return toItem(finished);
  }

  const { data, error } = await db()
    .from("media_share")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  raise(error);
  return toItem(asRow(data) ?? finished);
}

export async function friendFinished(id: string, finishedAt: Date): Promise<boolean> {
  requireDb();
  const row = await byId(id);
  if (!row || row.direction !== "sent") return false;
  if (!row.finished_at) {
    const now = new Date();
    const sentAt = new Date(row.sent_at);
    const when =
      Number.isNaN(finishedAt.getTime()) ||
      finishedAt > now ||
      (!Number.isNaN(sentAt.getTime()) && finishedAt < sentAt)
        ? now
        : finishedAt;
    const { error } = await db()
      .from("media_share")
      .update({ finished_at: when.toISOString() })
      .eq("id", id)
      .is("finished_at", null);
    raise(error);
  }
  return true;
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
