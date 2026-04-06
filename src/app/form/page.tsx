import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";

export default async function FormPage() {
  const session = await getSession();

  if (!session) {
    redirect("/");
  }

  const externalApplicationUrl = process.env.APPLICATION_FORM_URL?.trim() || null;

  // Deprecated in favor of the external Fillout flow.
  // import FormClient from "./FormClient";
  // return <FormClient />;

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-6 py-10">
      <div className="mx-auto w-full max-w-xl rounded-3xl border border-white/10 p-6 md:p-8">
        <div className="space-y-3">
          <h1 className="text-4xl text-white">Applications have moved</h1>
          <p className="font-body text-lg leading-relaxed text-white">
            The application now runs through Fillout and syncs back here automatically.
          </p>
          <p className="font-body text-base leading-relaxed text-white">
            {externalApplicationUrl
              ? "Use the external application form below."
              : "Ask the team for the current application link."}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {externalApplicationUrl ? (
            <a
              href={externalApplicationUrl}
              className="inline-flex h-12 items-center rounded-xl bg-primary px-8 text-lg text-white transition-opacity hover:opacity-80"
            >
              Open application form
            </a>
          ) : null}
          <a
            href="/dashboard"
            className="inline-flex h-12 items-center rounded-xl bg-secondary px-8 text-lg text-black transition-opacity hover:opacity-80"
          >
            Back to dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
