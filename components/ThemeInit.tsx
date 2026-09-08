"use client";
import { useEffect } from "react";

export default function ThemeInit() {
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const dark = saved ? saved === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  }, []);
  return null;
}