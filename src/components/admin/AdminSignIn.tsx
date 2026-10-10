"use client";
import { useState } from "react";
import { api } from "@/lib/client-api";
import { Button, Field, Notice } from "@/components/ui";

type Step = "login" | "email" | "otp" | "enroll" | "mfa" | "password";
export function AdminSignIn({
  onAuthenticated,
}: {
  onAuthenticated: () => Promise<void>;
}) {
  const [step, setStep] = useState<Step>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [svg, setSvg] = useState("");
  const [secret, setSecret] = useState("");
  const [setup, setSetup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function prepareMfa(existing: string | null) {
    setStep("enroll");
    if (existing) {
      setFactorId(existing);
      setQr("");
      setSvg("");
      setSecret("");
    } else {
      const enrolled = await api<{
        factorId: string;
        qrCode: string;
        secret?: string;
      }>("auth/admin-mfa/enroll", "POST", {});
      setFactorId(enrolled.factorId);
      if (enrolled.secret) setSecret(enrolled.secret);
      const raw = enrolled.qrCode || "";
      let svgMarkup = "";
      let dataUri = "";
      if (raw.startsWith("data:image/svg+xml;utf-8,")) {
        svgMarkup = decodeURIComponent(
          raw.slice("data:image/svg+xml;utf-8,".length)
        );
        dataUri = raw;
      } else if (raw.startsWith("data:image/svg+xml,")) {
        svgMarkup = decodeURIComponent(raw.slice("data:image/svg+xml,".length));
        dataUri = raw;
      } else if (raw.startsWith("<svg")) {
        svgMarkup = raw;
        dataUri = `data:image/svg+xml;utf-8,${encodeURIComponent(raw)}`;
      } else {
        dataUri = raw;
      }
      setSvg(svgMarkup);
      setQr(dataUri);
    }
    setCode("");
    setStep("mfa");
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if (step === "login") {
        const result = await api<{ factorId: string | null }>(
          "auth/admin-login",
          "POST",
          { email, password }
        );
        setPassword("");
        await prepareMfa(result.factorId);
      } else if (step === "email") {
        const result = await api<{ challengeId: string }>(
          "auth/admin-setup/request",
          "POST",
          { email }
        );
        setChallengeId(result.challengeId);
        setCode("");
        setStep("otp");
      } else if (step === "otp") {
        await api("auth/confirm-verification", "POST", { challengeId, code });
        const status = await api<{ factorId: string | null }>(
          "auth/admin-mfa/status"
        );
        await prepareMfa(status.factorId);
      } else if (step === "enroll") {
        const status = await api<{ factorId: string | null }>(
          "auth/admin-mfa/status"
        );
        await prepareMfa(status.factorId);
      } else if (step === "mfa") {
        await api("auth/mfa", "POST", { factorId, code });
        setCode("");
        setQr("");
        if (setup) setStep("password");
        else await onAuthenticated();
      } else {
        if (password !== confirmation)
          throw new Error("The passwords do not match.");
        await api("auth/admin-password", "POST", { password });
        setPassword("");
        setConfirmation("");
        await onAuthenticated();
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function restart(next: "email" | "login") {
    setBusy(true);
    setError("");
    try {
      await api("auth/logout", "POST", {});
      setSetup(next === "email");
      setStep(next);
      setPassword("");
      setConfirmation("");
      setCode("");
      setQr("");
      setFactorId("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && <Notice error>{error}</Notice>}
      <form onSubmit={submit}>
        {(step === "login" || step === "email") && (
          <Field label="Staff email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </Field>
        )}
        {step === "email" && (
          <Notice>
            Set up or reset your password using the email of your existing owner
            or staff account. Verify your email and authenticator to continue.
          </Notice>
        )}
        {step === "login" && (
          <Field label="Password">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
        )}
        {step === "otp" && (
          <>
            <Notice>Enter the verification code emailed to {email}.</Notice>
            <CodeField
              label="Email verification code"
              code={code}
              setCode={setCode}
            />
          </>
        )}
        {step === "mfa" && (
          <>
            {(svg || qr) && (
              <>
                <Notice>
                  Scan this QR code in Google Authenticator, Microsoft
                  Authenticator or another authenticator app, or enter the setup
                  key manually below.
                </Notice>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    margin: "20px 0",
                  }}
                >
                  {svg ? (
                    <div
                      style={{
                        background: "white",
                        padding: 16,
                        borderRadius: 8,
                        maxWidth: 240,
                        width: "100%",
                        display: "flex",
                        justifyContent: "center",
                      }}
                      dangerouslySetInnerHTML={{ __html: svg }}
                    />
                  ) : (
                    <img
                      src={qr}
                      width={220}
                      height={220}
                      alt="Scan to set up your Balaji Studio authenticator"
                      style={{
                        maxWidth: "100%",
                        background: "white",
                        borderRadius: 8,
                      }}
                    />
                  )}
                  {secret && (
                    <div
                      style={{
                        marginTop: 14,
                        textAlign: "center",
                        width: "100%",
                      }}
                    >
                      <small
                        style={{
                          color: "var(--muted, #64748b)",
                          display: "block",
                          marginBottom: 6,
                          fontSize: "11px",
                        }}
                      >
                        Manual key (if you cannot scan the QR code):
                      </small>
                      <code
                        style={{
                          background: "rgba(0,0,0,0.06)",
                          padding: "6px 12px",
                          borderRadius: 6,
                          fontSize: "13px",
                          letterSpacing: "0.12em",
                          fontFamily: "monospace",
                          display: "inline-block",
                          userSelect: "all",
                          wordBreak: "break-all",
                        }}
                      >
                        {secret}
                      </code>
                    </div>
                  )}
                </div>
              </>
            )}
            {!qr && !svg && (
              <Notice>
                Enter the code from your enrolled authenticator app.
              </Notice>
            )}
            <CodeField
              label="Authenticator code"
              code={code}
              setCode={setCode}
            />
          </>
        )}
        {step === "enroll" && (
          <Notice>
            Prepare your authenticator to finish setting up secure dashboard
            access.
          </Notice>
        )}
        {step === "password" && (
          <>
            <Field label="New password" hint="Use at least 12 characters.">
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm password">
              <input
                type="password"
                required
                minLength={12}
                maxLength={128}
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="new-password"
              />
            </Field>
          </>
        )}
        <Button type="submit" disabled={busy}>
          {busy
            ? "Verifying…"
            : {
                login: "Sign in",
                email: "Send verification code",
                otp: "Verify email",
                enroll: "Set up authenticator",
                mfa: setup ? "Verify authenticator" : "Verify & open dashboard",
                password: "Save password & open dashboard",
              }[step]}
        </Button>
      </form>
      <Button
        variant="ghost"
        disabled={busy}
        onClick={() => restart(step === "login" ? "email" : "login")}
      >
        {step === "login"
          ? "First-time setup / forgot password"
          : "Back to sign in"}
      </Button>
      {step === "otp" && (
        <Button
          variant="ghost"
          disabled={busy}
          onClick={() => {
            setStep("email");
            setCode("");
            setError("");
          }}
        >
          Request a new email code
        </Button>
      )}
    </>
  );
}
function CodeField({
  label,
  code,
  setCode,
}: {
  label: string;
  code: string;
  setCode: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <input
        required
        inputMode="numeric"
        pattern="[0-9]{6,8}"
        minLength={6}
        maxLength={8}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        autoComplete="one-time-code"
      />
    </Field>
  );
}
