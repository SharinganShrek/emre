"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Loader2, Search, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import {
  KIND_LABEL,
  KIND_SOURCE,
  MAX_DAYS,
  MIN_DAYS,
  NOTE_MAX,
  SHARE_KINDS,
  UNKNOWN_DAYS,
  allowanceDays,
  elapsedShare,
  isShareImage,
  minQueryLength,
  sourceLink,
  timeLeft,
  type ExchangeState,
  type ShareHit,
  type ShareItem,
  type ShareKind,
  type ShareMedia,
} from "@/lib/media-share";

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function useNow(initial: string): Date {
  const [now, setNow] = useState(() => new Date(initial));
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function Cover({ media, size }: { media: ShareMedia; size: "sm" | "lg" }) {
  const [hidden, setHidden] = useState<string | null>(null);
  const image = media.image && isShareImage(media.image) ? media.image : null;
  const cls = size === "lg" ? "w-20 sm:w-24" : "w-12";
  if (!image || hidden === image) {
    return (
      <div
        className={`${cls} aspect-[2/3] shrink-0 rounded-lg bg-surface-2`}
        aria-hidden
      />
    );
  }
  return (
    // Catalogue covers are already on TMDB, MyAnimeList, or Google Books.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt=""
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setHidden(image)}
      className={`${cls} aspect-[2/3] shrink-0 rounded-lg bg-surface-2 object-cover`}
    />
  );
}

function MediaLines({ media }: { media: ShareMedia }) {
  const link = sourceLink(media.kind, media.sourceId);
  const meta = [KIND_LABEL[media.kind], media.year, media.lengthLabel]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="min-w-0 space-y-0.5">
      <p className="break-words font-semibold text-foreground">{media.title}</p>
      {media.altTitle ? (
        <p className="break-words text-sm text-muted">{media.altTitle}</p>
      ) : null}
      <p className="text-xs text-muted">{meta}</p>
      {media.creator || media.facts.length > 0 ? (
        <p className="break-words text-xs text-muted">
          {[media.creator, ...media.facts].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      {link ? (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted underline underline-offset-2 hover:text-foreground"
        >
          {KIND_SOURCE[media.kind]}
          <ExternalLink className="size-3" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

function Timer({
  item,
  now,
  whose,
}: {
  item: ShareItem;
  now: Date;
  whose: string;
}) {
  const left = timeLeft(new Date(item.dueAt), now);
  const share = elapsedShare(new Date(item.sentAt), new Date(item.dueAt), now);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span
          className={`text-2xl font-bold ${left.late ? "text-warning" : "text-foreground"}`}
        >
          {left.text}
        </span>
        <span className="text-xs text-muted">
          {whose} {when(item.dueAt)}
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-surface-2" role="presentation">
        <div
          className={`h-full ${left.late ? "bg-warning" : "bg-primary"}`}
          style={{ width: `${Math.round(share * 100)}%` }}
        />
      </div>
    </div>
  );
}

function ErrorLine({ error }: { error: string | null }) {
  if (!error) return null;
  return (
    <p className="break-words rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
      {error}
    </p>
  );
}

function Received({
  item,
  friend,
  now,
}: {
  item: ShareItem | null;
  friend: string;
  now: Date;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function finish(id: string) {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/exchange/${id}/finish`, { method: "POST" }).catch(
      () => null,
    );
    const data = (await res?.json().catch(() => ({}))) as {
      error?: string;
      item?: { notifiedAt?: string | null };
    };
    setBusy(false);
    if (!res?.ok) {
      setError(data?.error ?? "Couldn't save that — try again.");
      return;
    }
    if (!data.item?.notifiedAt) {
      setError(`Saved, but ${friend}'s site didn't answer — try telling them again.`);
    }
    router.refresh();
  }

  if (!item || (item.finishedAt && item.notifiedAt)) {
    return (
      <div className="space-y-1">
        <p className="text-sm text-foreground">Nothing from {friend} right now.</p>
        {item?.finishedAt ? (
          <p className="text-xs text-muted">
            You finished {item.media.title} on {day(item.finishedAt)}.
          </p>
        ) : null}
      </div>
    );
  }

  if (item.finishedAt) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-foreground">
          You finished {item.media.title}, but {friend}&apos;s site hasn&apos;t heard
          yet — so they can&apos;t send the next one.
        </p>
        <ErrorLine error={error} />
        <Button
          type="button"
          variant="outline"
          onClick={() => finish(item.id)}
          disabled={busy}
        >
          {busy ? <Loader2 className="animate-spin" /> : <Send />}
          Tell them again
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex min-w-0 gap-4">
        <Cover media={item.media} size="lg" />
        <div className="min-w-0 space-y-2">
          <MediaLines media={item.media} />
          {item.note ? (
            <p className="break-words text-sm text-foreground">&ldquo;{item.note}&rdquo;</p>
          ) : null}
          <p className="text-xs text-muted">Sent {when(item.sentAt)}</p>
        </div>
      </div>
      <Timer item={item} now={now} whose="due" />
      <ErrorLine error={error} />
      <Button type="button" onClick={() => finish(item.id)} disabled={busy}>
        {busy ? <Loader2 className="animate-spin" /> : <Check />}
        Finished it
      </Button>
    </div>
  );
}

function hitMedia(kind: ShareKind, hit: ShareHit): ShareMedia {
  return {
    kind,
    sourceId: hit.sourceId,
    title: hit.title,
    altTitle: hit.altTitle,
    year: hit.year,
    image: hit.image,
    creator: null,
    facts: [],
    lengthMinutes: null,
    lengthLabel: hit.meta,
  };
}

function SendForm({ friend, onClose }: { friend: string; onClose: () => void }) {
  const router = useRouter();
  const [kind, setKind] = useState<ShareKind>("movie");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ShareHit[] | null>(null);
  const [picked, setPicked] = useState<ShareHit | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"search" | "send" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const least = minQueryLength(kind);

  function pickKind(next: ShareKind) {
    setKind(next);
    setResults(null);
    setPicked(null);
    setError(null);
  }

  async function runSearch(event: FormEvent) {
    event.preventDefault();
    if (query.trim().length < least) return;
    setBusy("search");
    setError(null);
    setPicked(null);
    const res = await fetch(
      `/api/exchange/search?${new URLSearchParams({ kind, q: query.trim() })}`,
    ).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as {
      error?: string;
      results?: ShareHit[];
    };
    setBusy(null);
    if (!res?.ok) {
      setResults(null);
      setError(data?.error ?? "Search failed — try again.");
      return;
    }
    setResults(data.results ?? []);
  }

  async function send() {
    if (!picked) return;
    setBusy("send");
    setError(null);
    const res = await fetch("/api/exchange/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        sourceId: picked.sourceId,
        note: note.trim() || null,
      }),
    }).catch(() => null);
    const data = (await res?.json().catch(() => ({}))) as { error?: string };
    setBusy(null);
    if (!res?.ok) {
      setError(data?.error ?? "Couldn't send it — try again.");
      return;
    }
    onClose();
    router.refresh();
  }

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex items-start gap-2">
        <div className="flex flex-1 flex-wrap gap-1.5" role="group" aria-label="What to send">
          {SHARE_KINDS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => pickKind(option)}
              aria-pressed={option === kind}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                option === kind
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface-2 text-foreground hover:bg-card-hover"
              }`}
            >
              {KIND_LABEL[option]}
            </button>
          ))}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onClose}
          aria-label="Close without sending"
        >
          <X />
        </Button>
      </div>

      <form onSubmit={runSearch} className="flex min-w-0 gap-2">
        <label htmlFor="exchange-query" className="sr-only">
          Search {KIND_SOURCE[kind]}
        </label>
        <Input
          id="exchange-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Search ${KIND_SOURCE[kind]}`}
          className="min-w-0 flex-1"
        />
        <Button
          type="submit"
          variant="outline"
          disabled={busy !== null || query.trim().length < least}
          className="shrink-0"
        >
          {busy === "search" ? <Loader2 className="animate-spin" /> : <Search />}
          <span className="max-sm:sr-only">Search</span>
        </Button>
      </form>

      <ErrorLine error={error} />

      {picked ? (
        <div className="space-y-3">
          <div className="flex min-w-0 items-start gap-3">
            <Cover media={hitMedia(kind, picked)} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="break-words font-semibold text-foreground">{picked.title}</p>
              <p className="text-xs text-muted">
                {[KIND_LABEL[kind], picked.year, picked.meta].filter(Boolean).join(" · ")}
              </p>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="mt-1 text-xs text-muted underline underline-offset-2 hover:text-foreground"
              >
                Pick another
              </button>
            </div>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">
              A note with it (optional)
            </span>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={NOTE_MAX}
              rows={2}
              placeholder="A note for them"
            />
          </label>
          <Button
            type="button"
            onClick={send}
            disabled={busy !== null}
            className="h-auto max-w-full whitespace-normal py-2 text-left"
          >
            {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />}
            Send to {friend}
          </Button>
        </div>
      ) : results ? (
        results.length === 0 ? (
          <p className="text-sm text-muted">Nothing found on {KIND_SOURCE[kind]}.</p>
        ) : (
          <ul className="max-h-[22rem] divide-y divide-border overflow-y-auto">
            {results.map((result) => (
              <li key={result.sourceId}>
                <button
                  type="button"
                  onClick={() => setPicked(result)}
                  className="flex w-full min-w-0 items-center gap-3 px-1 py-2 text-left hover:bg-surface-2"
                >
                  <Cover media={hitMedia(kind, result)} size="sm" />
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold text-foreground">
                      {result.title}
                    </span>
                    {result.altTitle ? (
                      <span className="block break-words text-xs text-muted">
                        {result.altTitle}
                      </span>
                    ) : null}
                    <span className="block text-xs text-muted">
                      {[result.year, result.meta].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  );
}

function Sent({
  item,
  friend,
  now,
}: {
  item: ShareItem | null;
  friend: string;
  now: Date;
}) {
  const [open, setOpen] = useState(false);

  if (item && !item.finishedAt) {
    return (
      <div className="space-y-4">
        <div className="flex min-w-0 gap-3">
          <Cover media={item.media} size="sm" />
          <div className="min-w-0">
            <p className="break-words font-semibold text-foreground">{item.media.title}</p>
            <p className="text-xs text-muted">
              {[KIND_LABEL[item.media.kind], item.media.lengthLabel]
                .filter(Boolean)
                .join(" · ")}
              {" · "}sent {day(item.sentAt)}
            </p>
          </div>
        </div>
        <Timer item={item} now={now} whose={`${friend} has until`} />
        <p className="text-xs text-muted">
          You can send the next one once they mark it finished.
        </p>
      </div>
    );
  }

  if (open) return <SendForm friend={friend} onClose={() => setOpen(false)} />;

  return (
    <div className="space-y-3">
      <p className="text-sm text-foreground">
        {item?.finishedAt
          ? `${friend} finished ${item.media.title} on ${day(item.finishedAt)}.`
          : `Nothing sent to ${friend} yet.`}
      </p>
      <Button type="button" onClick={() => setOpen(true)}>
        <Send /> Send something
      </Button>
      <p className="text-xs text-muted">
        A movie, show, anime, manga or book. {friend} gets about a day per hour of it —
        a two-hour film is {allowanceDays(120)} days — at least {MIN_DAYS}, at most{" "}
        {MAX_DAYS}, and {UNKNOWN_DAYS} when its length isn&apos;t known.
      </p>
    </div>
  );
}

function Panel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-2">
          {label}
        </p>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function MediaExchange({
  state,
  now: initialNow,
}: {
  state: ExchangeState;
  now: string;
}) {
  const now = useNow(initialNow);

  if (!state.ready) {
    return (
      <Card>
        <CardContent className="pt-5">
          <p className="text-sm text-foreground">{state.message}</p>
        </CardContent>
      </Card>
    );
  }

  if (!state.friend) {
    return (
      <Card>
        <CardContent className="space-y-1 pt-5">
          <p className="text-sm text-foreground">
            Connect a friend&apos;s site to send each other movies, shows, anime, manga
            and books.
          </p>
          <p className="text-xs text-muted">
            Set FRIEND_SITE_URL, FRIEND_NAME and EXCHANGE_TOKEN (the same 32+ characters
            on both sites), then redeploy. The checklist is in USER_ACTION_ITEMS.md.
          </p>
        </CardContent>
      </Card>
    );
  }

  const friend = state.friend.name;
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">
      <Panel label={`from ${friend}`}>
        <Received item={state.received} friend={friend} now={now} />
      </Panel>
      <Panel label={`to ${friend}`}>
        <Sent item={state.sent} friend={friend} now={now} />
      </Panel>
    </div>
  );
}
