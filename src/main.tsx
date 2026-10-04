import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Staff from "./Staff";
import "./styles.css";
import "./warm-editorial.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {window.location.pathname === "/staff.html" ? <Staff /> : <App />}
  </StrictMode>,
);
