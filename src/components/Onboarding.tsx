import { useState, type CSSProperties, type FormEvent } from "react";
import { updateSettings } from "../lib/store";
import { Button } from "./ui";

// The logo's scattered particles, drifting around it while the app waits for a name.
const PARTICLES = [
  { left: "-44px", top: "6px", size: 7, color: "#38bdf8", dx: "8px", dy: "6px", duration: "6s" },
  { left: "118px", top: "-14px", size: 9, color: "#ec4899", dx: "-6px", dy: "8px", duration: "7s" },
  { left: "136px", top: "74px", size: 6, color: "#a855f7", dx: "-8px", dy: "-6px", duration: "5.5s" },
  { left: "-30px", top: "88px", size: 8, color: "#38bdf8", dx: "7px", dy: "-7px", duration: "6.5s" },
  { left: "22px", top: "-30px", size: 5, color: "#c084fc", dx: "5px", dy: "7px", duration: "5s" },
];

export function Onboarding() {
  const [name, setName] = useState("");

  const finish = (displayName: string) => {
    void updateSettings({ displayName: displayName.trim(), onboarded: true });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (name.trim()) finish(name);
  };

  return (
    <div className="page-in flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-8 pb-16">
      <div className="relative">
        {PARTICLES.map((particle) => (
          <span
            key={`${particle.left}${particle.top}`}
            aria-hidden
            style={
              {
                left: particle.left,
                top: particle.top,
                width: particle.size,
                height: particle.size,
                background: particle.color,
                "--dx": particle.dx,
                "--dy": particle.dy,
                animation: `drift ${particle.duration} ease-in-out infinite`,
              } as CSSProperties
            }
            className="absolute rounded-full opacity-80"
          />
        ))}
        <img src="/logo.svg" alt="" width={104} height={104} />
      </div>

      <h1 className="mt-6 font-display text-[34px] leading-[42px] font-bold tracking-[-0.025em] text-ink">
        Welcome to Stardust
      </h1>
      <p className="mt-1 text-[15px] text-ink-2">scattered thoughts, gathered</p>

      <form onSubmit={submit} className="mt-9 w-full max-w-[340px]">
        <label htmlFor="display-name" className="mb-1.5 block font-semibold text-ink">
          What shall we call you?
        </label>
        <input
          id="display-name"
          autoFocus
          autoComplete="off"
          spellCheck={false}
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          className="field h-10! text-[15px]"
        />
        <Button type="submit" variant="primary" disabled={!name.trim()} className="mt-3 h-10! w-full text-[15px]">
          Get started
        </Button>
        <button
          type="button"
          onClick={() => finish("")}
          className="mt-2 w-full rounded py-1 text-[13px] text-ink-3 hover:text-ink"
        >
          Skip for now
        </button>
      </form>
    </div>
  );
}
