import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter, redirect } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import { loadPersistedAuth } from "./lib/auth";
import "leaflet/dist/leaflet.css";
import "./styles.css";

// Rehydrate auth token from localStorage before the router boots
loadPersistedAuth();

// Create query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 2,
    },
  },
});

// Create router
const router = createRouter({
  routeTree,
  context: { queryClient },
});

// Register router types
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element not found");

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
