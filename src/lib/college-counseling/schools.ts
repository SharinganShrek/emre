import type { SchoolOption } from "./types";

export function normalizeSchoolGroup(
  value: unknown,
): SchoolOption["group"] {
  return value === "europe_main" ? "europe_main" : "us_need_blind";
}

export function withoutNeedAwareSchools(
  schools: { group: string }[] | undefined,
): SchoolOption[] {
  return ((schools ?? []) as SchoolOption[]).filter(
    (s) => s.group !== ("us_need_aware" as string),
  );
}
