import { getTranslations } from "next-intl/server";

export default async function AdminOrdersPage() {
  const t = await getTranslations();

  return (
    <div>
      <h1 className="mb-6 text-4xl text-white">{t("admin.orders.title")}</h1>
      <div>
        <p className="font-body text-xl text-white">{t("admin.orders.empty")}</p>
      </div>
    </div>
  );
}
