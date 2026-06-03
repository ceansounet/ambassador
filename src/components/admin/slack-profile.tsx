export function SlackAvatar({
  slackId,
  fallbackName,
  sizeClassName = "h-11 w-11",
  textClassName = "text-base",
}: {
  slackId?: string | null;
  fallbackName?: string | null;
  sizeClassName?: string;
  textClassName?: string;
}) {
  const trimmedFallbackName = fallbackName?.trim() ?? "";
  const displayName = trimmedFallbackName !== "" ? trimmedFallbackName : "Unknown";
  const initial = displayName.charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-full border border-foreground p-1 ${sizeClassName}`}
    >
      {slackId !== null && slackId !== undefined && slackId !== "" ? (
        <div
          aria-label={displayName}
          className="h-full w-full rounded-full bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url("https://cachet.dunkirk.sh/users/${slackId}/r")` }}
        />
      ) : (
        <div
          className={`flex h-full w-full items-center justify-center rounded-full bg-secondary text-black ${textClassName}`}
        >
          {initial}
        </div>
      )}
    </div>
  );
}

export function SlackProfile({
  label,
  slackName,
  slackId,
  fallbackName,
}: {
  label: string;
  slackName?: string | null;
  slackId?: string | null;
  fallbackName?: string | null;
}) {
  const trimmedDisplayName = (slackName ?? fallbackName)?.trim() ?? "";
  const displayName = trimmedDisplayName !== "" ? trimmedDisplayName : "Unknown";

  return (
    <div className="grid gap-2 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-4">
      <div className="text-sm text-secondary">{label}</div>
      <div className="flex items-center gap-3">
        <SlackAvatar slackId={slackId} fallbackName={displayName} />
        <div className="font-body text-base text-foreground">
          {displayName}
          {slackId !== null && slackId !== undefined && slackId !== "" ? ` (${slackId})` : ""}
        </div>
      </div>
    </div>
  );
}
