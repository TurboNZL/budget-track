import { createRoot } from "react-dom/client";
import "./globals.css";
// Starts the look (turbothemes) before the first render, so the page never flashes the wrong theme
import "./lib/themes";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(<App />);
