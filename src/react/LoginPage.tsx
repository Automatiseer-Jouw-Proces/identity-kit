"use client";

import { type CSSProperties, type ReactNode } from "react";
import { useIdentity } from "./useIdentity.js";

export type LoginPageProps = {
  title?: string;
  subtitle?: string;
  brandName?: string;
  logoUrl?: string;
  redirectPathAfterLogin?: string;
  errorMessage?: string;
  footer?: ReactNode;
};

export function LoginPage({
  title = "Inloggen",
  subtitle = "Log in om verder te gaan",
  brandName = "Automatiseer Jouw Proces",
  logoUrl,
  redirectPathAfterLogin,
  errorMessage,
  footer,
}: LoginPageProps) {
  const { login, status } = useIdentity();

  const handleLogin = () => {
    login(
      redirectPathAfterLogin
        ? {
            redirect: redirectPathAfterLogin,
          }
        : undefined,
    );
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        {logoUrl ? <img src={logoUrl} alt={brandName} style={logoStyle} /> : null}
        <div style={brandStyle}>{brandName}</div>
        <h1 style={titleStyle}>{title}</h1>
        {subtitle ? <p style={subtitleStyle}>{subtitle}</p> : null}
        {errorMessage ? <p style={errorStyle}>{errorMessage}</p> : null}
        <button style={buttonStyle} onClick={handleLogin} disabled={status === "loading"}>
          {status === "loading" ? "Laden..." : "Inloggen met Azure"}
        </button>
        {footer ? <div style={footerStyle}>{footer}</div> : null}
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "radial-gradient(circle at 20% 20%, #e8eefc, #f7f9fc 50%)",
  padding: "24px",
};

const cardStyle: CSSProperties = {
  width: "100%",
  maxWidth: "420px",
  background: "#ffffff",
  borderRadius: "16px",
  boxShadow: "0 18px 60px rgba(0, 28, 92, 0.1)",
  padding: "32px",
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
};

const logoStyle: CSSProperties = {
  width: "64px",
  height: "64px",
  objectFit: "contain",
  margin: "0 auto",
};

const brandStyle: CSSProperties = {
  fontSize: "14px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#3b4b71",
};

const titleStyle: CSSProperties = {
  margin: "0",
  fontSize: "28px",
  fontWeight: 700,
  color: "#1f2d4d",
};

const subtitleStyle: CSSProperties = {
  margin: "0",
  color: "#4f5f7a",
  fontSize: "15px",
};

const errorStyle: CSSProperties = {
  margin: "8px 0",
  color: "#b42318",
  background: "#fde4e0",
  borderRadius: "8px",
  padding: "8px 12px",
  fontSize: "14px",
};

const buttonStyle: CSSProperties = {
  marginTop: "8px",
  padding: "14px 16px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #1f6feb, #3556e2)",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: "16px",
  cursor: "pointer",
  transition: "transform 0.1s ease, box-shadow 0.1s ease",
  boxShadow: "0 12px 30px rgba(53, 86, 226, 0.35)",
} as const;

const footerStyle: CSSProperties = {
  marginTop: "16px",
  color: "#6b7385",
  fontSize: "13px",
};
