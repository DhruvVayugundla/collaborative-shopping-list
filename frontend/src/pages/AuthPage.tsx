import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link, Navigate, useLocation } from "react-router";
import { useLogin, useMe } from "../api/hooks";
import { InlineError } from "../components/Feedback";
import { btnPrimary, card, input } from "../lib/ui";

const schema = z.object({
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{3,30}$/, "3-30 characters: letters, numbers or underscores"),
  password: z.string().min(8, "At least 8 characters").max(72, "At most 72 characters"),
});
type Form = z.infer<typeof schema>;

export function AuthPage({ mode }: { mode: "login" | "register" }) {
  const { data: user } = useMe();
  const location = useLocation();
  const auth = useLogin(mode);
  const { register, handleSubmit, formState } = useForm<Form>({ resolver: zodResolver(schema) });

  const from = (location.state as { from?: string } | null)?.from ?? "/lists";
  if (user) return <Navigate to={from} replace />;

  const isLogin = mode === "login";
  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div aria-hidden className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-emerald-600 text-2xl">
            🛒
          </div>
          <h1 className="text-2xl font-semibold">{isLogin ? "Welcome back" : "Create your account"}</h1>
          <p className="mt-1 text-sm text-slate-500">Shopping lists you share with the people you live with.</p>
        </div>

        <form className={`${card} space-y-4 p-6`} onSubmit={handleSubmit((v) => auth.mutate(v))} noValidate>
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium">
              Username
            </label>
            <input
              id="username"
              className={input}
              autoComplete="username"
              autoCapitalize="none"
              autoFocus
              aria-invalid={!!formState.errors.username}
              {...register("username")}
            />
            <InlineError error={formState.errors.username?.message} />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              className={input}
              autoComplete={isLogin ? "current-password" : "new-password"}
              aria-invalid={!!formState.errors.password}
              {...register("password")}
            />
            <InlineError error={formState.errors.password?.message} />
          </div>
          <InlineError error={auth.error} />
          <button type="submit" className={`${btnPrimary} w-full`} disabled={auth.isPending}>
            {auth.isPending ? "Please wait…" : isLogin ? "Log in" : "Sign up"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-600">
          {isLogin ? "New here? " : "Already have an account? "}
          <Link
            to={isLogin ? "/register" : "/login"}
            state={location.state}
            className="font-medium text-emerald-700 hover:underline"
          >
            {isLogin ? "Create an account" : "Log in"}
          </Link>
        </p>
      </div>
    </div>
  );
}
