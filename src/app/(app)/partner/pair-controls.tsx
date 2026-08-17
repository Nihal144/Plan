"use client";

import { useActionState, useEffect, useState } from "react";
import {
  generateCode,
  redeemCode,
  respondToRequest,
  unpair,
  type ActionState,
} from "@/app/actions/pairing";
import type { PairStatus, PendingRequest, OutgoingRequest, LiveCode } from "@/lib/dal";

const EMPTY: ActionState = {};

function Notice({ state }: { state: ActionState }) {
  if (!state.error) return null;
  return (
    <p
      role="alert"
      className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950 dark:text-red-300"
    >
      {state.error}
    </p>
  );
}

/**
 * Surfaces the 15-minute TTL so expiry is visible rather than a surprise.
 *
 * The clock is read in an effect rather than during render: `Date.now()` in a
 * render body is impure, and server and client would compute different values
 * and mismatch on hydration. Rendering nothing on the first pass avoids that.
 */
function Expiry({ expiresAt }: { expiresAt: string }) {
  const [minutes, setMinutes] = useState<number | null>(null);

  useEffect(() => {
    const tick = () =>
      setMinutes(
        Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 60000)),
      );
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  if (minutes === null) return null;

  return (
    <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
      {minutes > 0 ? `Expires in about ${minutes} min` : "Expired — generate a new one"}
    </p>
  );
}

export function CodePanel({ liveCode }: { liveCode: LiveCode | null }) {
  const [state, action, pending] = useActionState(generateCode, EMPTY);

  return (
    <section className="mb-6">
      <h2 className="mb-1 font-medium">Your invite code</h2>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Share this with one person. It works once and expires after 15 minutes.
      </p>

      {liveCode && (
        <>
          <div className="rounded-xl bg-zinc-100 py-5 text-center font-mono text-4xl font-semibold tracking-[0.3em] dark:bg-zinc-800">
            {liveCode.code}
          </div>
          <Expiry expiresAt={liveCode.expires_at} />
        </>
      )}

      <form action={action} className="mt-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          {pending ? "Generating…" : liveCode ? "Generate a new code" : "Generate a code"}
        </button>
      </form>
      <Notice state={state} />
    </section>
  );
}

export function RedeemForm({ outgoing }: { outgoing: OutgoingRequest | null }) {
  const [state, action, pending] = useActionState(redeemCode, EMPTY);

  if (outgoing) {
    return (
      <section className="mb-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
        <h2 className="mb-1 font-medium">Request sent</h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Waiting for {outgoing.display_name ?? "them"} to accept.
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
      <h2 className="mb-1 font-medium">Have someone&apos;s code?</h2>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        They&apos;ll get a request to approve before you&apos;re paired.
      </p>

      <form action={action} className="flex flex-col gap-2.5 sm:flex-row">
        <input
          name="code"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          placeholder="0000"
          aria-label="Partner's 4-digit code"
          autoComplete="off"
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 px-3.5 py-2.5 font-mono tracking-[0.3em] focus:border-blue-500 focus:outline-none focus:ring-[3px] focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800"
        />
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 rounded-lg bg-zinc-900 px-5 py-2.5 font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Sending…" : "Send request"}
        </button>
      </form>
      <Notice state={state} />
    </section>
  );
}

export function RequestList({ requests }: { requests: PendingRequest[] }) {
  const [state, action, pending] = useActionState(respondToRequest, EMPTY);

  if (requests.length === 0) return null;

  return (
    <section className="mb-6 border-t border-zinc-100 pt-6 dark:border-zinc-800">
      <h2 className="mb-4 font-medium">Pair requests</h2>

      <ul className="list-none p-0">
        {requests.map((req) => (
          <li key={req.request_id} className="flex items-center gap-3 py-2">
            <span className="min-w-0 flex-1 truncate">
              {req.display_name ?? "Someone"} wants to pair
            </span>
            <form action={action} className="flex shrink-0 gap-2">
              <input type="hidden" name="requestId" value={req.request_id} />
              <button
                type="submit"
                name="accept"
                value="true"
                disabled={pending}
                className="rounded-lg bg-zinc-900 px-3.5 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Accept
              </button>
              <button
                type="submit"
                name="accept"
                value="false"
                disabled={pending}
                className="rounded-lg border border-zinc-300 px-3.5 py-1.5 text-sm disabled:opacity-50 dark:border-zinc-700"
              >
                Decline
              </button>
            </form>
          </li>
        ))}
      </ul>
      <Notice state={state} />
    </section>
  );
}

/** The partner page renders the profile card itself; this is just the control. */
export function PairedPanel({ pair }: { pair: PairStatus }) {
  const [state, action, pending] = useActionState(unpair, EMPTY);

  return (
    <section>
      <h2 className="mb-1 font-medium">Unpair</h2>
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        Disconnects you from {pair.display_name ?? "your partner"}. Either of you can
        pair with someone else afterwards.
      </p>

      <form action={action}>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-red-950 dark:hover:text-red-300"
        >
          {pending ? "Unpairing…" : "Unpair"}
        </button>
      </form>
      <Notice state={state} />
    </section>
  );
}
