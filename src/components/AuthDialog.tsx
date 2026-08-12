import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function AuthDialog({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password: senha })
        : await supabase.auth.signUp({
            email,
            password: senha,
            options: { emailRedirectTo: window.location.origin },
          });
    setBusy(false);
    if (res.error) setMsg(res.error.message);
    else if (mode === "signup" && !res.data.session) setMsg("Confira seu e-mail para confirmar a conta.");
    else onClose();
  };

  const google = async () => {
    setBusy(true);
    setMsg(null);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
    if (error) {
      setMsg(error.message);
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-background/85 p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm space-y-3 rounded-2xl border border-border bg-panel p-5"
      >
        <h2 className="font-display text-xl tracking-wide">
          {mode === "login" ? "Entrar no" : "Criar conta no"} TATICS<span className="text-accent">PRO</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Com login, seus campinhos, desenhos e análises ficam salvos na sua conta.
        </p>
        <button
          type="button"
          onClick={google}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-panel-2 py-2 text-sm font-semibold hover:border-accent disabled:opacity-60"
        >
          <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.6l6.7-6.7C35.6 2.6 30.2.5 24 .5 14.6.5 6.5 5.9 2.6 13.8l7.8 6.1C12.3 13.9 17.6 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.2-.4-4.7H24v9h12.7c-.6 3-2.3 5.6-4.9 7.3l7.6 5.9c4.4-4.1 7.1-10.2 7.1-17.5z" />
            <path fill="#FBBC05" d="M10.4 28.1c-.5-1.5-.8-3-.8-4.6s.3-3.1.8-4.6l-7.8-6.1C.9 16.1 0 19.9 0 23.5s.9 7.4 2.6 10.7l7.8-6.1z" />
            <path fill="#34A853" d="M24 47.5c6.2 0 11.5-2 15.4-5.6l-7.6-5.9c-2.1 1.4-4.8 2.3-7.8 2.3-6.4 0-11.7-4.4-13.6-10.2l-7.8 6.1C6.5 42.1 14.6 47.5 24 47.5z" />
          </svg>
          Continuar com Google
        </button>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> ou <span className="h-px flex-1 bg-border" />
        </div>

        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail"
          className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <input
          type="password"
          required
          minLength={6}
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          placeholder="Senha"
          className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none focus:border-accent"
        />
        {msg && <p className="text-xs text-destructive">{msg}</p>}
        <button
          disabled={busy}
          className="w-full rounded-lg bg-accent py-2 font-display tracking-wide text-accent-foreground disabled:opacity-60"
        >
          {mode === "login" ? "Entrar" : "Cadastrar"}
        </button>
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="w-full text-xs text-muted-foreground hover:text-foreground"
        >
          {mode === "login" ? "Não tenho conta" : "Já tenho conta"}
        </button>
        <button type="button" onClick={onClose} className="w-full text-xs text-muted-foreground">
          Continuar sem login
        </button>
      </form>
    </div>
  );
}
