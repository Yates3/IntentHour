import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { DesktopApp } from "./desktop-app";
import "./styles.css";

const root = document.querySelector("#root");
if (!root) throw new Error("IntentHour Desktop root element is missing.");

createRoot(root).render(
  <StrictMode>
    <DesktopApp />
  </StrictMode>,
);
