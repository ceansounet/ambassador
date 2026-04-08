import { notFound } from "next/navigation";

// Deprecated on-site flow kept here intentionally.
// import FormClient from "./FormClient";

export default function FormPage() {
  notFound();

  // Deprecated in favor of the external Fillout flow.
  // return <FormClient />;
}
