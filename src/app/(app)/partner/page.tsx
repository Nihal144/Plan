import { requireUser, getPairingState } from "@/lib/dal";
import {
  CodePanel,
  RedeemForm,
  RequestList,
  PairedPanel,
} from "./pair-controls";

export default async function PartnerPage() {
  await requireUser();
  const { pair, pendingRequests, outgoing, liveCode } = await getPairingState();

  return (
    <div className="flex flex-col gap-7 px-6 py-8 lg:px-10 lg:py-9">
      <header>
        <h1 className="text-3xl font-bold tracking-tight lg:text-[2.4rem]">Partner</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          {pair ? "You're linked up." : "Link up with one other person."}
        </p>
      </header>

      {pair ? (
        <div className="flex max-w-[560px] flex-col gap-5">
          {/* Profile card */}
          <div className="flex items-center gap-4 rounded-2xl bg-zinc-100/70 p-6 dark:bg-zinc-800/40">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-bold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
              {(pair.display_name ?? "?").charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold">
                {pair.display_name ?? "Your partner"}
              </p>
              <p className="flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
                Paired
              </p>
            </div>
          </div>

          {/* Honest empty state: the database genuinely shares nothing yet, and
              this page should say so rather than imply a feature that isn't built. */}
          <div className="rounded-2xl border border-dashed border-zinc-200 px-6 py-10 text-center dark:border-zinc-700">
            <p className="font-semibold">Nothing shared yet</p>
            <p className="mx-auto mt-1 max-w-[38ch] text-sm text-zinc-500 dark:text-zinc-400">
              Your tasks stay private to each of you. Shared plans arrive in the next
              phase — the boundary is enforced in the database, not just here.
            </p>
          </div>

          <div className="rounded-2xl bg-zinc-100/70 p-6 dark:bg-zinc-800/40">
            <PairedPanel pair={pair} />
          </div>
        </div>
      ) : (
        <div className="max-w-[560px] rounded-2xl bg-zinc-100/70 p-6 dark:bg-zinc-800/40">
          <CodePanel liveCode={liveCode} />
          <RedeemForm outgoing={outgoing} />
          <RequestList requests={pendingRequests} />
        </div>
      )}
    </div>
  );
}
