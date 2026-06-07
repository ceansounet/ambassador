"use client";

import Icon from "@hackclub/icons";
import { Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

import { SlackAvatar } from "@/components/admin/slack-profile";
import { Input } from "@/components/ui/input";
import type { SafeguardKey } from "@/lib/safeguards";

type OverrideEntry = {
  userId: string;
  displayName: string;
  email: string | null;
  slackId: string | null;
};

type Candidate = {
  userId: string;
  displayName: string;
  email: string | null;
  slackId: string | null;
};

type SafeguardControl = {
  key: SafeguardKey;
  title: string;
  description: string;
  enabled: boolean;
  enableAction: string;
  disableAction: string;
  overrides: OverrideEntry[];
};

type Strings = {
  columns: { toggle: string; flag: string; description: string };
  errorMessages: { update: string; override: string };
  overrides: {
    heading: string;
    empty: string;
    addLabel: string;
    addPlaceholder: string;
    addButton: string;
    candidatesEmpty: string;
    candidatesLoading: string;
    removeLabel: string;
    removeConfirm: string;
    notFound: string;
    alreadyExists: string;
  };
};

export function SafeguardsClient({
  controls,
  columns,
  errorMessages,
  overrides: overridesStrings,
}: Strings & {
  controls: SafeguardControl[];
}) {
  const router = useRouter();
  const [states, setStates] = useState(() =>
    Object.fromEntries(controls.map((control) => [control.key, control.enabled])),
  );
  const [overrideLists, setOverrideLists] = useState(() =>
    Object.fromEntries(controls.map((control) => [control.key, control.overrides])),
  );
  const [pendingKey, setPendingKey] = useState<SafeguardKey | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addPending, setAddPending] = useState<string | null>(null);
  const [removePending, setRemovePending] = useState<string | null>(null);
  const [openSearchKey, setOpenSearchKey] = useState<SafeguardKey | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchSeqRef = useRef(0);

  useEffect(() => {
    if (openSearchKey === null) return;
    const query = searchQuery.trim();
    if (query === "") {
      setCandidates([]);
      setSearchLoading(false);
      return;
    }

    const seq = ++searchSeqRef.current;
    setSearchLoading(true);
    const handle = setTimeout(() => {
      void (async () => {
        try {
          const response = await fetch(
            `/api/admin/feature-flag-overrides?q=${encodeURIComponent(query)}`,
          );
          if (seq !== searchSeqRef.current) return;
          if (!response.ok) {
            setCandidates([]);
            return;
          }
          const data = (await response.json()) as { candidates: Candidate[] };
          setCandidates(data.candidates ?? []);
        } catch {
          if (seq === searchSeqRef.current) setCandidates([]);
        } finally {
          if (seq === searchSeqRef.current) setSearchLoading(false);
        }
      })();
    }, 200);

    return () => clearTimeout(handle);
  }, [searchQuery, openSearchKey]);

  async function toggleSafeguard(control: SafeguardControl) {
    if (pendingKey !== null) return;
    const currentEnabled = states[control.key] ?? control.enabled;
    const nextEnabled = !currentEnabled;
    setPendingKey(control.key);
    setError(null);
    setStates((current) => ({ ...current, [control.key]: nextEnabled }));

    try {
      const response = await fetch("/api/admin/safeguards", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: control.key, enabled: nextEnabled }),
      });
      if (!response.ok) throw new Error("update failed");
      router.refresh();
    } catch {
      setStates((current) => ({ ...current, [control.key]: currentEnabled }));
      setError(errorMessages.update);
    } finally {
      setPendingKey(null);
    }

    if (nextEnabled && openSearchKey === control.key) {
      setOpenSearchKey(null);
      setSearchQuery("");
      setCandidates([]);
    }
  }

  async function addOverride(control: SafeguardControl, candidate: Candidate) {
    const addKey = `${control.key}:${candidate.userId}`;
    if (addPending !== null) return;
    setAddPending(addKey);
    setError(null);
    try {
      const response = await fetch("/api/admin/feature-flag-overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagKey: control.key, identifier: candidate.userId }),
      });
      if (response.status === 404) {
        setError(overridesStrings.notFound);
        return;
      }
      if (response.status === 409) {
        setError(overridesStrings.alreadyExists);
        return;
      }
      if (!response.ok) throw new Error("add failed");
      const data = (await response.json()) as { override: OverrideEntry };
      setOverrideLists((current) => {
        const existing = current[control.key] ?? [];
        if (existing.some((entry) => entry.userId === data.override.userId)) return current;
        return {
          ...current,
          [control.key]: [...existing, { ...data.override, slackId: candidate.slackId }].sort(
            (a, b) => a.displayName.localeCompare(b.displayName),
          ),
        };
      });
      setOpenSearchKey(null);
      setSearchQuery("");
      setCandidates([]);
      router.refresh();
    } catch {
      setError(errorMessages.override);
    } finally {
      setAddPending(null);
    }
  }

  async function removeOverride(control: SafeguardControl, userId: string) {
    if (removePending !== null) return;
    if (!window.confirm(overridesStrings.removeConfirm)) return;
    const removeKey = `${control.key}:${userId}`;
    setRemovePending(removeKey);
    setError(null);
    try {
      const response = await fetch("/api/admin/feature-flag-overrides", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ flagKey: control.key, userId }),
      });
      if (!response.ok) throw new Error("remove failed");
      setOverrideLists((current) => ({
        ...current,
        [control.key]: (current[control.key] ?? []).filter((entry) => entry.userId !== userId),
      }));
      router.refresh();
    } catch {
      setError(errorMessages.override);
    } finally {
      setRemovePending(null);
    }
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-foreground">
              <th className="px-4 py-4 font-body text-base leading-8 text-secondary">{columns.flag}</th>
              <th className="px-4 py-4 font-body text-base leading-8 text-secondary">{columns.description}</th>
              <th className="px-4 py-4 font-body text-base leading-8 text-secondary text-center">{columns.toggle}</th>
            </tr>
          </thead>
          <tbody>
            {controls.map((control) => {
              const enabled = states[control.key] ?? control.enabled;
              const pending = pendingKey === control.key;
              const overridesList = overrideLists[control.key] ?? [];
              const isSearchOpen = openSearchKey === control.key;
              const existingIds = new Set(overridesList.map((entry) => entry.userId));

              return (
                <Fragment key={control.key}>
                  <tr className="align-top">
                    <td className="px-4 pt-4 pb-2 font-body text-base text-foreground">{control.title}</td>
                    <td className="px-4 pt-4 pb-2 font-body text-sm text-foreground">{control.description}</td>
                    <td className="px-4 pt-4 pb-2 text-center">
                      <button
                        type="button"
                        data-slot="icon-link"
                        aria-label={enabled ? control.disableAction : control.enableAction}
                        title={enabled ? control.disableAction : control.enableAction}
                        className="inline-flex cursor-pointer appearance-none border-0 bg-transparent p-0 text-base leading-none outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                        style={{ color: enabled ? "var(--acceptance)" : "var(--primary)" }}
                        disabled={pending || pendingKey !== null}
                        onClick={() => void toggleSafeguard(control)}
                      >
                        {enabled ? "●" : "○"}
                      </button>
                    </td>
                  </tr>
                  {!enabled ? (
                    // The override key spans the full row as one tidy block — a
                    // quiet bold eyebrow on the left, the add control flush right —
                    // so the title never wraps inside the narrow flag column.
                    <tr>
                      <td colSpan={3} className="px-4 pt-2 pb-1">
                        <div className="flex items-center justify-between gap-3">
                          <span className="whitespace-nowrap font-body text-sm font-bold leading-4 text-secondary">
                            {overridesStrings.heading}
                          </span>
                          <button
                            type="button"
                            data-slot="icon-link"
                            aria-label={overridesStrings.addLabel}
                            title={overridesStrings.addLabel}
                            onClick={() => {
                              if (isSearchOpen) {
                                setOpenSearchKey(null);
                                setSearchQuery("");
                                setCandidates([]);
                              } else {
                                setOpenSearchKey(control.key);
                                setSearchQuery("");
                                setCandidates([]);
                                setError(null);
                              }
                            }}
                            className="ui-open-link inline-flex shrink-0 items-center justify-center"
                          >
                            <Plus size={18} strokeWidth={2.25} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                  {!enabled ? (
                    <>
                      {overridesList.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="border-t border-foreground/10 px-4 py-2 font-body text-sm text-secondary">
                            {overridesStrings.empty}
                          </td>
                        </tr>
                      ) : (
                        overridesList.map((entry, index) => {
                          const removeKey = `${control.key}:${entry.userId}`;
                          const removing = removePending === removeKey;
                          return (
                            <tr key={entry.userId} className="group">
                              <td
                                colSpan={2}
                                className={`px-4 py-2 ${index === 0 ? "border-t border-foreground/10" : "border-t border-foreground/5"}`}
                              >
                                <div className="flex items-center gap-3">
                                  <SlackAvatar
                                    slackId={entry.slackId}
                                    fallbackName={entry.displayName}
                                    sizeClassName="h-8 w-8"
                                    textClassName="text-xs"
                                  />
                                  <a
                                    href={`/admin/users/${entry.userId}`}
                                    className="flex min-w-0 flex-1 flex-col font-body text-sm text-foreground transition-opacity hover:opacity-70"
                                  >
                                    <span className="truncate">{entry.displayName}</span>
                                    {entry.email ? (
                                      <span className="truncate text-xs text-secondary">{entry.email}</span>
                                    ) : null}
                                  </a>
                                </div>
                              </td>
                              <td
                                className={`px-4 py-2 text-center align-middle ${index === 0 ? "border-t border-foreground/10" : "border-t border-foreground/5"}`}
                              >
                                <button
                                  type="button"
                                  data-slot="icon-link"
                                  aria-label={overridesStrings.removeLabel}
                                  title={overridesStrings.removeLabel}
                                  disabled={removing || removePending !== null}
                                  onClick={() => void removeOverride(control, entry.userId)}
                                  className="inline-flex h-6 w-6 cursor-pointer items-center justify-center appearance-none border-0 bg-transparent p-0 text-[color:var(--foreground)] outline-none opacity-0 transition-colors group-hover:opacity-100 focus-visible:opacity-100 hover:text-[color:var(--primary)] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                  <Icon glyph="delete" size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}

                      {isSearchOpen ? (
                        <tr className="border-b border-foreground last:border-b-0">
                          <td colSpan={3} className="border-t border-foreground/10 px-4 pb-4 pt-4">
                            <div className="space-y-2">
                              <div className="relative w-full">
                                <Search
                                  size={14}
                                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40"
                                />
                                <Input
                                  autoFocus
                                  name={`override-search-${control.key}`}
                                  aria-label={overridesStrings.addLabel}
                                  placeholder={overridesStrings.addPlaceholder}
                                  value={searchQuery}
                                  onChange={(event) => setSearchQuery(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      setOpenSearchKey(null);
                                      setSearchQuery("");
                                      setCandidates([]);
                                    }
                                  }}
                                  className="ui-input-surface !bg-muted h-9 w-full !rounded-none border-0 pl-9 pr-3 font-body text-sm font-normal text-foreground placeholder:text-foreground/40 hover:!bg-muted md:text-sm"
                                />
                              </div>
                              {searchQuery.trim() === "" ? null : searchLoading ? (
                                <div className="px-1 font-body text-sm text-secondary">
                                  {overridesStrings.candidatesLoading}
                                </div>
                              ) : candidates.length === 0 ? (
                                <div className="px-1 font-body text-sm text-secondary">
                                  {overridesStrings.candidatesEmpty}
                                </div>
                              ) : (
                                <ul className="max-h-72 w-full divide-y divide-foreground/10 overflow-y-auto border border-foreground/10 bg-muted">
                                  {candidates.map((candidate) => {
                                    const addKey = `${control.key}:${candidate.userId}`;
                                    const alreadyAdded = existingIds.has(candidate.userId);
                                    const adding = addPending === addKey;
                                    const meta = [candidate.email, candidate.slackId]
                                      .filter((value): value is string => value !== null && value !== "")
                                      .join(" · ");
                                    return (
                                      <li key={candidate.userId}>
                                        <button
                                          type="button"
                                          data-slot="icon-link"
                                          onClick={() => void addOverride(control, candidate)}
                                          disabled={alreadyAdded || adding || addPending !== null}
                                          className="flex w-full cursor-pointer appearance-none items-center gap-3 border-0 bg-transparent px-3 py-2 text-left font-body text-sm text-foreground outline-none transition-colors hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
                                        >
                                          <SlackAvatar
                                            slackId={candidate.slackId}
                                            fallbackName={candidate.displayName}
                                            sizeClassName="h-8 w-8"
                                            textClassName="text-xs"
                                          />
                                          <span className="flex min-w-0 flex-1 flex-col">
                                            <span className="truncate">{candidate.displayName}</span>
                                            {meta ? (
                                              <span className="truncate text-xs text-secondary">{meta}</span>
                                            ) : null}
                                          </span>
                                          {alreadyAdded ? (
                                            <span className="shrink-0 text-xs text-secondary">
                                              {overridesStrings.alreadyExists}
                                            </span>
                                          ) : null}
                                        </button>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </>
                  ) : null}
                  <tr aria-hidden="true" className="last:hidden">
                    <td colSpan={3} className="border-b border-foreground p-0" />
                  </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      {error ? <p className="font-body text-sm text-primary">{error}</p> : null}
    </>
  );
}
