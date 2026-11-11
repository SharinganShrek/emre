import "server-only";

export class CatalogError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "CatalogError";
  }
}

/** JSON GET. The URL may contain an API key, so it is never put on the error. */
export async function getJson(
  url: string,
  headers?: HeadersInit,
): Promise<{ status: number; body: unknown }> {
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "EmreOS/1.0",
        ...headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const body = (await res.json().catch(() => null)) as unknown;
    return { status: res.status, body };
  } catch {
    throw new CatalogError(
      "The catalogue didn't answer — try again in a minute.",
      502,
    );
  }
}
