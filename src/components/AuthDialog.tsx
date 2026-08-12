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
