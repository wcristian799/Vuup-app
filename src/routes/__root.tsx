import { createRootRouteWithContext, Link, Outlet } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/sonner";

interface RouterContext {
  queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary">404</h1>
        <p className="mt-2 text-muted-foreground">Página não encontrada</p>
        <Link to="/" className="mt-4 inline-block text-electric underline">
          Voltar ao início
        </Link>
      </div>
    </div>
  ),
});

function RootLayout() {
  return (
    <>
      <Outlet />
      <Toaster position="top-center" richColors />
    </>
  );
}
