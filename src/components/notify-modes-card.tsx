"use client";

// When and how to be notified: a summary on a schedule, and/or an instant alert
// as soon as an important article is found. Hours are Paris time (the scraper runs
// every hour on the hour).

const DAYS = ["Di", "Lu", "Ma", "Me", "Je", "Ve", "Sa"]; // JS weekday order, same as sync_days
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];
const INSTANT_LEVELS = [7, 8, 9, 10];
const HOUR_CHOICES = [6, 7, 8, 9, 10, 12, 14, 17, 18, 19, 20, 21];

type Schedule = { hours: number[] | null; days: number[] | null };
type PresetKey = "each" | "daily" | "weekdays" | "friday" | "custom";

const same = (a: number[] | null, b: number[] | null) =>
  a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));

function presetOf({ hours, days }: Schedule): { key: PresetKey; hour: number } {
  if (!hours?.length && !days?.length) return { key: "each", hour: 9 };
  if (hours && hours.length === 1) {
    const hour = hours[0];
    if (same(days, ALL_DAYS) || !days?.length) return { key: "daily", hour };
    if (same(days, WEEKDAYS)) return { key: "weekdays", hour };
    if (same(days, [5])) return { key: "friday", hour };
  }
  return { key: "custom", hour: hours?.[0] ?? 9 };
}

function scheduleFor(key: PresetKey, hour: number, current: Schedule): Schedule {
  switch (key) {
    case "each": return { hours: null, days: null };
    case "daily": return { hours: [hour], days: ALL_DAYS };
    case "weekdays": return { hours: [hour], days: WEEKDAYS };
    case "friday": return { hours: [hour], days: [5] };
    default: return { hours: current.hours?.length ? current.hours : [hour], days: current.days?.length ? current.days : ALL_DAYS };
  }
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={onClick}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-primary" : "bg-surface-hover"}`}>
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-[11px] font-mono transition-all ${
        active ? "bg-primary/15 text-primary border border-primary/25"
          : "bg-surface text-muted-foreground/50 border border-transparent hover:text-muted-foreground"}`}>
      {children}
    </button>
  );
}

export function NotifyModesCard({
  digest, onDigest, schedule, onSchedule, instantMin, onInstant, saved,
}: {
  digest: boolean;
  onDigest: (on: boolean) => void;
  schedule: Schedule;
  onSchedule: (s: Schedule) => void;
  instantMin: number | null;
  onInstant: (min: number | null) => void;
  saved: boolean;
}) {
  const { key, hour } = presetOf(schedule);
  const choose = (k: PresetKey, h = hour) => onSchedule(scheduleFor(k, h, schedule));
  const toggleIn = (list: number[] | null, v: number) => {
    const cur = list ?? [];
    return cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v].sort((a, b) => a - b);
  };

  return (
    <div className="rounded-xl border border-border bg-card card-shadow p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-mono">quand te prévenir</h3>
        {saved && <span className="text-[10px] text-primary/60 font-mono animate-pulse">sauvegardé</span>}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] text-foreground">Résumé des articles</p>
          <p className="text-[11px] text-muted-foreground/50">Les meilleurs articles depuis le dernier envoi, rangés par thème.</p>
        </div>
        <Toggle on={digest} onClick={() => onDigest(!digest)} label="Résumé des articles" />
      </div>

      {digest && (
        <div className="mt-3 flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5">
            <Chip active={key === "daily"} onClick={() => choose("daily")}>chaque matin</Chip>
            <Chip active={key === "weekdays"} onClick={() => choose("weekdays")}>en semaine</Chip>
            <Chip active={key === "friday"} onClick={() => choose("friday")}>le vendredi</Chip>
            <Chip active={key === "each"} onClick={() => choose("each")}>à chaque nouveauté</Chip>
            <Chip active={key === "custom"} onClick={() => choose("custom")}>personnalisé</Chip>
          </div>
          {(key === "daily" || key === "weekdays" || key === "friday") && (
            <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
              à
              <select value={hour} onChange={(e) => choose(key, Number(e.target.value))}
                className="rounded-md bg-surface px-2 py-1 text-[12px] font-mono text-foreground focus:outline-none">
                {HOUR_CHOICES.map((h) => <option key={h} value={h}>{h} h</option>)}
              </select>
              <span className="text-[11px] text-muted-foreground/40">heure de Paris</span>
            </label>
          )}
          {key === "each" && (
            <p className="text-[11px] text-muted-foreground/50">Un résumé après chaque passage horaire qui trouve du nouveau.</p>
          )}
          {key === "custom" && (
            <div>
              <div className="flex gap-1 mb-2">
                {DAYS.map((label, i) => (
                  <button key={i} onClick={() => onSchedule({ ...schedule, days: toggleIn(schedule.days, i) })}
                    className={`flex-1 rounded-md py-1.5 text-[10px] font-mono transition-all ${
                      schedule.days?.includes(i) ? "bg-primary/15 text-primary border border-primary/25"
                        : "bg-surface text-muted-foreground/25 border border-transparent hover:text-muted-foreground/50"}`}>
                    {label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-12 gap-[3px]">
                {Array.from({ length: 24 }, (_, h) => (
                  <button key={h} onClick={() => onSchedule({ ...schedule, hours: toggleIn(schedule.hours, h) })}
                    className={`rounded py-1 text-[9px] font-mono transition-all ${
                      schedule.hours?.includes(h) ? "bg-primary/20 text-primary"
                        : "bg-surface text-muted-foreground/15 hover:text-muted-foreground/30"}`}>
                    {h.toString().padStart(2, "0")}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-[13px] text-foreground">Alerte immédiate</p>
          <p className="text-[11px] text-muted-foreground/50">Un message dès qu&apos;un article important arrive, sans attendre le résumé.</p>
        </div>
        <Toggle on={instantMin !== null} onClick={() => onInstant(instantMin === null ? 9 : null)} label="Alerte immédiate" />
      </div>
      {instantMin !== null && (
        <div className="mt-3 flex items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground/50 mr-1">note mini</span>
          {INSTANT_LEVELS.map((v) => (
            <Chip key={v} active={instantMin === v} onClick={() => onInstant(v)}>{v}/10</Chip>
          ))}
        </div>
      )}
    </div>
  );
}
