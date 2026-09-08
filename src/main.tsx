import React from "react";
import ReactDOM from "react-dom/client";
import { AppThemeProvider } from "./components/ThemeContext";
import App from "./App";
import { Header } from "./components/header.tsx";
import { Footer } from "./components/footer.tsx";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <Header />
      <App />
      <Footer />
    </AppThemeProvider>
  </React.StrictMode>,
);
