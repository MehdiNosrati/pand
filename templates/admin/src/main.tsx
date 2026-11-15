import { AdminApp } from "@pands/admin-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@methane-ui/tokens/tokens.css";
import "@methane-ui/css/index.css";
import "@pands/admin-ui/styles.css";
import "@methane-ui/react";

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  );
}
