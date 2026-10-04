import { Outlet } from "@tanstack/react-router";

export function AppShell() {
  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <Outlet />
    </div>
  );
}
