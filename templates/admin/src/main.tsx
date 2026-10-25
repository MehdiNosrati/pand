import { AdminApp } from "@pands/admin-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@pands/ui/styles.css";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  );
}
