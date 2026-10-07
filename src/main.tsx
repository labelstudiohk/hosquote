import { StrictMode } from "react";
import { Analytics } from "@vercel/analytics/react";
import { createRoot } from "react-dom/client";
import App from "./App";
import Staff from "./Staff";
import "./styles.css";
import "./warm-editorial.css";

const isStaff = window.location.pathname === "/staff.html" || new URLSearchParams(window.location.search).get("staff") === "1";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isStaff ? <Staff /> : <App />}
    <Analytics />
  </StrictMode>,
);
