import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import { LockKeyhole, LogIn, WalletCards } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getFirebaseServices } from "@/lib/firebase";

export function AuthGate({ children }: { children: (user: User, logout: () => Promise<void>) => ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let unsubscribe = () => {};
    getFirebaseServices()
      .then(({ auth }) => { unsubscribe = onAuthStateChanged(auth, (current) => { setUser(current); setLoading(false); }); })
      .catch(() => { setError("No se pudo iniciar la conexión segura."); setLoading(false); });
    return () => unsubscribe();
  }, []);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const { auth } = await getFirebaseServices();
      await signInWithEmailAndPassword(auth, String(data.get("email")).trim(), String(data.get("password")));
    } catch {
      setError("Correo o contraseña incorrectos.");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = async () => {
    const { auth } = await getFirebaseServices();
    await signOut(auth);
  };

  if (loading) return <div className="grid min-h-screen place-items-center bg-background"><p className="text-sm text-muted-foreground">Verificando acceso…</p></div>;
  if (user) return children(user, logout);

  return <main className="grid min-h-screen place-items-center bg-background px-4 py-10"><section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary text-primary-foreground"><WalletCards /></span><div><h1 className="text-xl font-extrabold">Credihogar Tumeremo</h1><p className="text-sm text-muted-foreground">Acceso al sistema de gestión</p></div></div><div className="my-7 flex items-center gap-3 rounded-xl bg-secondary p-3 text-sm text-secondary-foreground"><LockKeyhole className="h-5 w-5" /><span>Ingresa con tu cuenta autorizada.</span></div><form onSubmit={login} className="space-y-4"><div><Label htmlFor="login-email">Correo electrónico</Label><Input id="login-email" name="email" type="email" autoComplete="email" required className="mt-2 h-11 rounded-xl" /></div><div><Label htmlFor="login-password">Contraseña</Label><Input id="login-password" name="password" type="password" autoComplete="current-password" required minLength={6} className="mt-2 h-11 rounded-xl" /></div>{error && <p role="alert" className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}<Button type="submit" disabled={submitting} className="h-11 w-full rounded-xl"><LogIn />{submitting ? "Ingresando…" : "Iniciar sesión"}</Button></form></section></main>;
}