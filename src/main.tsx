import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "@fontsource-variable/inter/wght.css";
import "@fontsource/cantarell/latin-400.css";
import "@fontsource/cantarell/latin-700.css";
import "@fontsource/noto-sans/latin-400.css";
import "@fontsource/noto-sans/latin-500.css";
import "@fontsource/noto-sans/latin-700.css";
import "@fontsource/open-sans/latin-400.css";
import "@fontsource/open-sans/latin-600.css";
import "@fontsource/open-sans/latin-700.css";
import "@fontsource/dejavu-sans/latin-400.css";
import "@fontsource/dejavu-sans/latin-700.css";
import "@fontsource/roboto/latin-400.css";
import "@fontsource/roboto/latin-500.css";
import "@fontsource/roboto/latin-700.css";
import "./globals.css";
import "./ui-styles.css";
import { initAppearance } from "./lib/appearance";

initAppearance();

createRoot(document.getElementById("root")!).render(<App />);
