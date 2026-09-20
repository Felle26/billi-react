import React from "react";
import ReactDOM from "react-dom/client";
import { AppThemeProvider } from "./components/ThemeContext";
import App from "./App";
import { Header } from "./components/Header.tsx";
import { Footer } from "./components/Footer.tsx";
import { HashRouter } from "react-router-dom";

import "./App.css";


ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AppThemeProvider>
      <div className="flex h-screen w-full flex-col overflow-hidden">
      <HashRouter>
          <Header />
          <div className="flex min-h-0 grow flex-col overflow-hidden">
          <App />
        </div>
        <Footer />
      </HashRouter>
      </div>
    </AppThemeProvider>
  </React.StrictMode>,
);
