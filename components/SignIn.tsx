"use client";
import { signIn } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

export default function SignIn() {
  return (
    <main className="auth-page">
      <div className="auth-panel">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "12px" }}>
          <ThemeToggle />
        </div>
        <h1 className="auth-title">Study Video Tracker</h1>
        <p className="auth-subtitle">Organize, watch, and track your study videos in one place.</p>
        <button className="btn primary" style={{ width: "100%", padding: "12px", fontSize: "1rem" }} onClick={() => signIn("google")}>
          Continue with Google
        </button>
      </div>
    </main>
  );
}