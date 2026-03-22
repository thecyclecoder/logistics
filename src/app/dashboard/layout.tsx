import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/sidebar";
import PushPrompt from "@/components/push-prompt";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar email={user?.email || ""} />
      <main className="flex-1 overflow-y-auto bg-gray-50 p-4 pt-16 lg:p-6 lg:pt-6">
        <PushPrompt />
        {children}
      </main>
    </div>
  );
}
