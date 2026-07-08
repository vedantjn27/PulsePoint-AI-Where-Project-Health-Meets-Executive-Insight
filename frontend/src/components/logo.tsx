import logo from "@/assets/logo.png";

export function Logo({ size = 44, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src={logo}
        alt="PulsePoint AI"
        width={size}
        height={size}
        className="shrink-0 rounded-xl drop-shadow-[0_0_14px_rgba(120,120,255,0.5)]"
      />
      {showText && (
        <span className="font-bold tracking-tight text-xl leading-tight">
          Pulse<span className="text-gradient">Point</span> AI
        </span>
      )}
    </div>
  );
}
