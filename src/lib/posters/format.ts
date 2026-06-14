// One consistent way to name a poster across admin and ambassador surfaces: its
// name when it has one, otherwise its referral code, with the group name in
// parentheses when the poster belongs to a group ("Library wall (Spring batch)"
// or "abc123 (Spring batch)").
export function formatPosterLabel(input: {
  name?: string | null;
  referralCode: string;
  groupName?: string | null;
}): string {
  const name = input.name?.trim();
  const base = name ? name : input.referralCode;
  const group = input.groupName?.trim();
  return group ? `${base} (${group})` : base;
}
