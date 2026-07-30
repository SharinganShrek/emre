"use client";

import { toast as sonner } from "sonner";

export const toast = {
  success: (message: string) => sonner.success(message),
  error: (message: string) => sonner.error(message),
  message: (message: string) => sonner(message),
};

/** Run an async mutation with loading/error/success feedback. */
export async function withToast(
  action: () => Promise<unknown>,
  messages: { loading?: string; success: string; error?: string },
): Promise<boolean> {
  const id = messages.loading
    ? sonner.loading(messages.loading)
    : undefined;
  try {
    await action();
    if (id) sonner.success(messages.success, { id });
    else sonner.success(messages.success);
    return true;
  } catch (err) {
    const detail =
      err instanceof Error ? err.message : messages.error ?? "Something went wrong";
    if (id) sonner.error(detail, { id });
    else sonner.error(detail);
    return false;
  }
}
