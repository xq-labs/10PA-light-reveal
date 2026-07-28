import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <div className="space-y-3">
        <h1 className="text-3xl font-bold tracking-tight">AR Avatar Reveal</h1>
        <p className="text-neutral-400">
          A quick proof-of-concept for image-tracking AR.
        </p>
      </div>

      <ol className="w-full space-y-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 text-left text-sm leading-relaxed text-neutral-300">
        <li>
          <span className="mr-2 font-semibold text-neutral-100">1.</span>
          Tap <span className="font-semibold text-neutral-100">Launch AR</span> and
          allow camera access when prompted.
        </li>
        <li>
          <span className="mr-2 font-semibold text-neutral-100">2.</span>
          Point your camera at one of the known printed frames.
        </li>
        <li>
          <span className="mr-2 font-semibold text-neutral-100">3.</span>
          A personalized avatar appears over the character and tracks the frame as
          you move.
        </li>
      </ol>

      <div className="flex w-full flex-col gap-3">
        <Link
          href="/ar"
          className="w-full rounded-full bg-white px-6 py-3 text-center text-base font-semibold text-neutral-950 transition active:scale-[0.98]"
        >
          Launch AR
        </Link>
        <Link
          href="/ar?calibrate=true"
          className="w-full rounded-full border border-neutral-700 px-6 py-3 text-center text-sm font-medium text-neutral-300 transition active:scale-[0.98]"
        >
          Launch AR (calibration mode)
        </Link>
      </div>

      <p className="text-xs text-neutral-600">
        Works best on a phone in a well-lit room. Requires HTTPS + camera access.
      </p>
    </main>
  );
}
