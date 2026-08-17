import Image from "next/image";
import type { PairStatus } from "@/lib/dal";

/**
 * The two of you, side by side.
 *
 * The avatars overlap rather than sitting apart, which is what makes them read as
 * a pair instead of two unrelated people. Yours is on the left and on top, in the
 * order the sentence below them says it: you, and then them.
 */
export function PairHeader({
  pair,
  myName,
  myAvatar,
}: {
  pair: PairStatus;
  myName: string;
  myAvatar?: string;
}) {
  const partnerName = pair.display_name ?? "Your partner";

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl bg-zinc-100/70 px-6 py-8 dark:bg-zinc-800/40">
      <div className="flex items-center -space-x-4">
        {/* `relative z-10` puts yours over theirs; without it the later sibling
            wins and the overlap contradicts the order. */}
        <Avatar
          name={myName}
          src={myAvatar}
          className="relative z-10 bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300"
        />
        <Avatar
          name={partnerName}
          src={pair.avatar_url ?? undefined}
          className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
        />
      </div>

      <p className="text-center text-lg font-bold [overflow-wrap:anywhere]">
        You and {partnerName}
      </p>
    </div>
  );
}

/**
 * A photo when there is one, initials when there is not. The ring is the card
 * background rather than a colour, so the overlap cuts a clean edge between the
 * two circles in either theme.
 */
function Avatar({
  name,
  src,
  className,
}: {
  name: string;
  src?: string;
  className: string;
}) {
  // zinc-100/70 on white, and zinc-800/40 on the app's dark canvas, resolved.
  // Shared by both branches: the caller's stacking order has to survive whether
  // the person has a photo or not.
  const base = `h-16 w-16 rounded-full ring-4 ring-zinc-100 dark:ring-[#1a1c20] ${className}`;

  if (src) {
    return (
      <Image
        src={src}
        alt=""
        width={64}
        height={64}
        className={`${base} object-cover`}
        unoptimized
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${base} flex items-center justify-center text-xl font-bold`}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
