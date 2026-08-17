import { requireUser, getPairingState, getLoopedTasks } from "@/lib/dal";
import { today, addDays } from "@/lib/dates";
import { PairHeader } from "./pair-header";
import { LoopedPanel } from "./looped-panel";
import {
  CodePanel,
  RedeemForm,
  RequestList,
  PairedPanel,
} from "./pair-controls";

/**
 * How far ahead the shared view looks. Two weeks is far enough to cover the plans
 * you make together — a trip, an appointment — without turning the page into a
 * calendar. Past days are left out on purpose: this is what is coming.
 */
const WINDOW_DAYS = 14;

export default async function PartnerPage() {
  const user = await requireUser();
  const todayStr = today();
  const [{ pair, pendingRequests, outgoing, liveCode }, looped] = await Promise.all([
    getPairingState(),
    getLoopedTasks(todayStr, addDays(todayStr, WINDOW_DAYS)),
  ]);

  const partnerName = pair?.display_name ?? "Your partner";
  const myName =
    (user.user_metadata?.full_name as string | undefined) ??
    (user.user_metadata?.name as string | undefined) ??
    user.email ??
    "You";
  const myAvatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="flex flex-col gap-7 px-6 py-8 lg:px-10 lg:py-9">
      <header>
        <h1 className="text-3xl font-bold tracking-tight lg:text-[2.4rem]">Partner</h1>
        <p className="mt-1 text-zinc-500 dark:text-zinc-400">
          {pair ? "You're linked up." : "Link up with one other person."}
        </p>
      </header>

      {pair ? (
        <div className="flex max-w-[720px] flex-col gap-5">
          <PairHeader pair={pair} myName={myName} myAvatar={myAvatar} />

          {/* Straight into the work — no section heading, because on a page about
              the two of you there is nothing else it could be. */}
          <LoopedPanel looped={looped} todayStr={todayStr} partnerName={partnerName} />

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
