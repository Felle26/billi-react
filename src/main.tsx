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
      <div className="w-full min-h-screen flex flex-col">
      <HashRouter>
          <Header />
          <div className="grow">
          <App />
        </div>
        <Footer />
      </HashRouter>
      </div>
    </AppThemeProvider>
  </React.StrictMode>,
);
