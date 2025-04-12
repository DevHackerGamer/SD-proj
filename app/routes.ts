import Home from "./routes/home";
import AdminPage from "./routes/admin.js";
import React from "react";


export default [
    {
      path: "/",
      file: "./routes/home.tsx", // Path to the Home component
    },
    {
      path: "/admin",
      file: "./routes/admin.tsx", // Path to the AdminPage component
    },
  ];