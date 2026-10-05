import type { ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";

const AdminLayout = ({ children }: { readonly children: ReactNode }) => (
  <AdminShell>{children}</AdminShell>
);

export default AdminLayout;
