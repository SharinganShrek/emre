/**
 * Import a MAL list dump into movies via AniList (looked up by MAL id).
 *
 *   npx tsx scripts/import-anime-list.ts
 *   npx tsx scripts/import-anime-list.ts --dry-run
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { getAnilistByMalId } from "../src/lib/anime/anilist";
import { detailsToMovieFields } from "../src/lib/anime/movie";

interface ListEntry {
  title: string;
  malId: number;
  rating: number;
  watched: number;
  total: number | null;
}

const ENTRIES: ListEntry[] = [
  { title: "Bocchi the Rock!", malId: 47917, rating: 7, watched: 8, total: 12 },
  { title: "Vinland Saga Season 2", malId: 49387, rating: 9, watched: 24, total: 24 },
  { title: "5-toubun no Hanayome", malId: 38101, rating: 4, watched: 12, total: 12 },
  { title: "5-toubun no Hanayome ∬", malId: 39783, rating: 4, watched: 12, total: 12 },
  { title: "Angel Beats!", malId: 6547, rating: 7, watched: 13, total: 13 },
  { title: "Ano Hi Mita Hana no Namae wo Bokutachi wa Mada Shiranai.", malId: 9989, rating: 7, watched: 11, total: 11 },
  { title: "Ansatsu Kyoushitsu", malId: 24833, rating: 8, watched: 22, total: 22 },
  { title: "Ansatsu Kyoushitsu 2nd Season", malId: 30654, rating: 9, watched: 25, total: 25 },
  { title: "Ao Haru Ride", malId: 21995, rating: 6, watched: 12, total: 12 },
  { title: "Banana Fish", malId: 36649, rating: 10, watched: 24, total: 24 },
  { title: "Boku dake ga Inai Machi", malId: 31043, rating: 9, watched: 12, total: 12 },
  { title: "Boku no Hero Academia", malId: 31964, rating: 6, watched: 13, total: 13 },
  { title: "Boku no Hero Academia 2nd Season", malId: 33486, rating: 6, watched: 25, total: 25 },
  { title: "Boku no Hero Academia 3rd Season", malId: 36456, rating: 5, watched: 25, total: 25 },
  { title: "Boku no Hero Academia 4th Season", malId: 38408, rating: 5, watched: 25, total: 25 },
  { title: "Boku no Hero Academia 5th Season", malId: 41587, rating: 4, watched: 25, total: 25 },
  { title: "Buddy Daddies", malId: 53411, rating: 8, watched: 12, total: 12 },
  { title: "Chainsaw Man", malId: 44511, rating: 9, watched: 12, total: 12 },
  { title: "Charlotte", malId: 28999, rating: 10, watched: 13, total: 13 },
  { title: "Death Note", malId: 1535, rating: 9, watched: 37, total: 37 },
  { title: "Given", malId: 39533, rating: 8, watched: 11, total: 11 },
  { title: "Ijiranaide, Nagatoro-san", malId: 42361, rating: 2, watched: 12, total: 12 },
  { title: "Kaguya-sama wa Kokurasetai: Tensai-tachi no Renai Zunousen", malId: 37999, rating: 9, watched: 12, total: 12 },
  { title: "Kaguya-sama wa Kokurasetai: Ultra Romantic", malId: 43608, rating: 9, watched: 13, total: 13 },
  { title: "Kaguya-sama wa Kokurasetai? Tensai-tachi no Renai Zunousen", malId: 40591, rating: 9, watched: 12, total: 12 },
  { title: "Kakegurui", malId: 34933, rating: 5, watched: 12, total: 12 },
  { title: "Kanojo, Okarishimasu", malId: 40839, rating: 3, watched: 12, total: 12 },
  { title: "Karakai Jouzu no Takagi-san", malId: 35860, rating: 3, watched: 12, total: 12 },
  { title: "Kimetsu no Yaiba", malId: 38000, rating: 8, watched: 26, total: 26 },
  { title: "Kimetsu no Yaiba Movie: Mugen Ressha-hen", malId: 40456, rating: 7, watched: 1, total: 1 },
  { title: "Kimetsu no Yaiba: Yuukaku-hen", malId: 47778, rating: 7, watched: 11, total: 11 },
  { title: "Kimi no Na wa.", malId: 32281, rating: 7, watched: 1, total: 1 },
  { title: "Kimi no Suizou wo Tabetai", malId: 36098, rating: 7, watched: 1, total: 1 },
  { title: "Komi-san wa, Comyushou desu.", malId: 48926, rating: 6, watched: 12, total: 12 },
  { title: "Komi-san wa, Comyushou desu. 2nd Season", malId: 50631, rating: 6, watched: 12, total: 12 },
  { title: "Kono Subarashii Sekai ni Shukufuku wo!", malId: 30831, rating: 8, watched: 10, total: 10 },
  { title: "Kuroko no Basket", malId: 11771, rating: 7, watched: 25, total: 25 },
  { title: "Kuroko no Basket 2nd Season", malId: 16894, rating: 7, watched: 25, total: 25 },
  { title: "Kuroko no Basket 3rd Season", malId: 24415, rating: 7, watched: 25, total: 25 },
  { title: "Monster", malId: 19, rating: 10, watched: 74, total: 74 },
  { title: "Mushoku Tensei: Isekai Ittara Honki Dasu", malId: 39535, rating: 10, watched: 11, total: 11 },
  { title: "Mushoku Tensei: Isekai Ittara Honki Dasu Part 2", malId: 45576, rating: 9, watched: 12, total: 12 },
  { title: "Re:Zero kara Hajimeru Isekai Seikatsu", malId: 31240, rating: 8, watched: 25, total: 25 },
  { title: "Re:Zero kara Hajimeru Isekai Seikatsu 2nd Season", malId: 39587, rating: 9, watched: 13, total: 13 },
  { title: "Re:Zero kara Hajimeru Isekai Seikatsu 2nd Season Part 2", malId: 42203, rating: 7, watched: 12, total: 12 },
  { title: "Saiki Kusuo no Ψ-nan", malId: 33255, rating: 7, watched: 120, total: 120 },
  { title: "Seishun Buta Yarou wa Bunny Girl Senpai no Yume wo Minai", malId: 37450, rating: 10, watched: 13, total: 13 },
  { title: "Shigatsu wa Kimi no Uso", malId: 23273, rating: 6, watched: 22, total: 22 },
  { title: "Shingeki no Kyojin", malId: 16498, rating: 9, watched: 25, total: 25 },
  { title: "Shingeki no Kyojin Season 2", malId: 25777, rating: 9, watched: 12, total: 12 },
  { title: "Shingeki no Kyojin Season 3", malId: 35760, rating: 9, watched: 12, total: 12 },
  { title: "Shingeki no Kyojin Season 3 Part 2", malId: 38524, rating: 10, watched: 10, total: 10 },
  { title: "Shingeki no Kyojin: The Final Season", malId: 40028, rating: 9, watched: 16, total: 16 },
  { title: "Shingeki no Kyojin: The Final Season - Kanketsu-hen", malId: 51535, rating: 9, watched: 2, total: 2 },
  { title: "SK∞", malId: 42923, rating: 6, watched: 12, total: 12 },
  { title: "Spy x Family", malId: 50265, rating: 7, watched: 12, total: 12 },
  { title: "Spy x Family Part 2", malId: 50602, rating: 7, watched: 13, total: 13 },
  { title: "Steins;Gate", malId: 9253, rating: 10, watched: 24, total: 24 },
  { title: "Steins;Gate 0", malId: 30484, rating: 9, watched: 23, total: 23 },
  { title: "Sword Art Online", malId: 11757, rating: 5, watched: 25, total: 25 },
  { title: "Sword Art Online II", malId: 21881, rating: 3, watched: 24, total: 24 },
  { title: "Sword Art Online: Alicization - War of Underworld", malId: 39597, rating: 4, watched: 12, total: 12 },
  { title: "Sword Art Online: Alicization - War of Underworld 2nd Season", malId: 40540, rating: 5, watched: 11, total: 11 },
  { title: "Tokyo Revengers", malId: 42249, rating: 7, watched: 24, total: 24 },
  { title: "Toradora!", malId: 4224, rating: 6, watched: 25, total: 25 },
  { title: "Vinland Saga", malId: 37521, rating: 10, watched: 24, total: 24 },
  { title: "Yamada-kun to Lv999 no Koi wo Suru", malId: 53126, rating: 7, watched: 13, total: 13 },
  { title: "Yofukashi no Uta", malId: 50346, rating: 7, watched: 13, total: 13 },
  { title: "Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e", malId: 35507, rating: 9, watched: 12, total: 12 },
  { title: "Youkoso Jitsuryoku Shijou Shugi no Kyoushitsu e 2nd Season", malId: 51096, rating: 8, watched: 13, total: 13 },
  { title: "Yuri!!! on Ice", malId: 32995, rating: 6, watched: 12, total: 12 },
  { title: "[Oshi no Ko]", malId: 52034, rating: 9, watched: 11, total: 11 },
  { title: "Code Geass: Hangyaku no Lelouch R2", malId: 2904, rating: 5, watched: 10, total: 25 },
];

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function statusOf(entry: ListEntry): "watching" | "watched" {
  if (entry.total != null && entry.watched < entry.total) return "watching";
  return "watched";
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 6; i += 1) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const message = err instanceof Error ? err.message : String(err);
      const retryAfter = Number(/Retry-After=(\d+)/.exec(message)?.[1] ?? "0");
      const retryable = /429|rate|busy|502|503|504/i.test(message);
      if (!retryable || i === 5) break;
      await sleep(Math.max(retryAfter * 1000, 70_000));
    }
  }
  throw last instanceof Error ? last : new Error("request failed");
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const repair = process.argv.includes("--repair");
  const queue = repair
    ? ENTRIES.filter((entry) =>
        [39533, 40839, 35860, 24415, 50265].includes(entry.malId),
      )
    : ENTRIES;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const userId =
    process.env.HUB_USER_ID?.trim() ||
    process.env.AI_USER_ID?.trim() ||
    "00000000-0000-0000-0000-000000000001";

  if (!url || !serviceKey) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const seenRes = await supabase
    .from("movies")
    .select("source,external_id")
    .eq("user_id", userId);
  if (seenRes.error) throw seenRes.error;
  const seen = new Set(
    (seenRes.data ?? [])
      .filter((row) => row.source && row.external_id)
      .map((row) => `${row.source}:${row.external_id}`),
  );

  const failures: string[] = [];
  let inserted = 0;
  let skipped = 0;

  for (let i = 0; i < queue.length; i += 1) {
    const entry = queue[i]!;
    process.stdout.write(`${String(i + 1).padStart(2, "0")}/${queue.length} ${entry.title} … `);
    try {
      const details = await withRetry(() => getAnilistByMalId(entry.malId));
      const key = `anilist:${details.external_id}`;
      if (seen.has(key)) {
        console.log(`skip existing ${details.title}`);
        skipped += 1;
        await sleep(300);
        continue;
      }

      const fields = detailsToMovieFields(details);
      if (entry.malId === 51535) {
        fields.title = "Shingeki no Kyojin: The Final Season - Kanketsu-hen";
        fields.episodes = 2;
        fields.anime_type = "TV Special";
      }
      const status = statusOf(entry);
      const totalEps = fields.episodes ?? details.episodes ?? entry.total;
      const progress =
        status === "watched"
          ? (totalEps ?? entry.watched)
          : Math.min(entry.watched, totalEps ?? entry.watched);

      console.log(
        `→ ${details.title} (${details.anime_type ?? "?"}, ${details.episodes ?? "?"}) ${status} ${entry.rating}/10`,
      );

      if (!dryRun) {
        const now = new Date(Date.now() - i * 1000).toISOString();
        const { error } = await supabase.from("movies").insert({
          user_id: userId,
          ...fields,
          status,
          rating: entry.rating,
          review: null,
          watched_date: null,
          episodes_watched: progress,
          created_at: now,
          updated_at: now,
        });
        if (error) throw error;
        seen.add(key);
        inserted += 1;
      }

      await sleep(1100);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`FAIL ${message}`);
      failures.push(`${entry.title} (MAL ${entry.malId}): ${message}`);
      await sleep(1500);
    }
  }

  console.log("\nDone.");
  console.log(`inserted=${inserted} skipped=${skipped} failed=${failures.length} dryRun=${dryRun}`);
  if (failures.length) {
    console.log("Failures:");
    for (const line of failures) console.log(` - ${line}`);
    process.exitCode = 1;
  }
}

void main();
