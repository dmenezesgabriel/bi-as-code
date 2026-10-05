import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { DuckDbLive } from "./features/data/duckdb-live";
import { DataRuntimeProvider } from "./features/data/runtime";
import { router } from "./router.js";
import "./styles.css";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error(
    `Expected a #root element in index.html, found: ${String(rootElement)}`,
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <DataRuntimeProvider layer={DuckDbLive}>
      <RouterProvider router={router} />
    </DataRuntimeProvider>
  </StrictMode>,
);
