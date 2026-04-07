"use client";

export function DeleteApplicationButton({
  applicationId,
  label,
}: {
  applicationId: string;
  label: string;
}) {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!confirm("Delete this application from our side? It will resync from Airtable on the next sync.")) {
      e.preventDefault();
    }
  }

  return (
    <form
      action={`/api/admin/applications/${applicationId}/delete`}
      method="POST"
      className="max-w-xl space-y-3"
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="redirectTo" value="/admin/applications" />
      <button className="rounded-xl border border-rejection px-6 py-3 font-body text-sm text-rejection transition-colors hover:bg-rejection hover:text-white">
        {label}
      </button>
    </form>
  );
}
