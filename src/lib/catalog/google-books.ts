import "server-only";
import { CatalogError, getJson } from "@/lib/catalog/http";
import { asArray, asNumber, asRecord, asString, yearFrom } from "@/lib/catalog/json";
import { cleanImage, isSourceId, type CatalogBook } from "@/lib/media-share";

const BASE = "https://www.googleapis.com/books/v1/volumes";

function key(): string {
  const value = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (!value) {
    throw new CatalogError("Set GOOGLE_BOOKS_API_KEY to search books.", 503);
  }
  return value;
}

function cover(info: Record<string, unknown> | null): string | null {
  const links = asRecord(info?.imageLinks);
  const raw =
    asString(links?.thumbnail) ??
    asString(links?.smallThumbnail) ??
    asString(links?.small);
  return cleanImage(raw);
}

function bookFrom(row: Record<string, unknown>): CatalogBook | null {
  const id = asString(row.id);
  const info = asRecord(row.volumeInfo);
  const title = asString(info?.title);
  if (!id || !title || !isSourceId("book", id)) return null;
  const authors = asArray(info?.authors)
    .map((author) => asString(author))
    .filter((author): author is string => Boolean(author));
  return {
    id,
    title,
    author: authors.length ? authors.slice(0, 3).join(", ") : null,
    year: yearFrom(info?.publishedDate),
    cover: cover(info),
    publisher: asString(info?.publisher),
    pages: asNumber(info?.pageCount),
  };
}

async function books(path: string): Promise<unknown> {
  const join = path.includes("?") ? "&" : "?";
  const { status, body } = await getJson(
    `${BASE}${path}${join}key=${encodeURIComponent(key())}`,
  );
  if (status === 400 || status === 403) {
    throw new CatalogError("Google Books refused the API key.", 502);
  }
  if (status === 404) {
    throw new CatalogError("The catalogue doesn't have that any more.", 404);
  }
  if (status < 200 || status >= 300) {
    throw new CatalogError("Google Books didn't answer — try again in a minute.", 502);
  }
  return body;
}

export async function searchGoogleBooks(query: string): Promise<CatalogBook[]> {
  const body = asRecord(
    await books(`?q=${encodeURIComponent(query)}&maxResults=12&printType=books`),
  );
  return asArray(body?.items)
    .map((row) => {
      const record = asRecord(row);
      return record ? bookFrom(record) : null;
    })
    .filter((book): book is CatalogBook => Boolean(book));
}

export async function getGoogleBook(id: string): Promise<CatalogBook> {
  const body = asRecord(await books(`/${encodeURIComponent(id)}`));
  const book = body ? bookFrom(body) : null;
  if (!book) throw new CatalogError("The catalogue doesn't have that any more.", 404);
  return book;
}
