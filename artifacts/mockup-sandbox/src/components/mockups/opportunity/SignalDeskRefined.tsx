import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

type Stage = "to-apply" | "applied" | "interviewing" | "completed";
type ViewKey = "focus" | "all" | "done";
type Priority = "high" | "medium" | "low";

type Opportunity = {
  id: number;
  title: string;
  organization: string;
  type: string;
  stage: Stage;
  deadline: string;
  summary: string;
  priority: Priority;
  progress: number;
};

const STAGES: { key: Stage; label: string; short: string; color: string }[] = [
  { key: "to-apply", label: "To apply", short: "To apply", color: "#eb6447" },
  { key: "applied", label: "Applied", short: "Applied", color: "#d89c32" },
  { key: "interviewing", label: "In conversation", short: "In talk", color: "#4271cb" },
  { key: "completed", label: "Closed", short: "Closed", color: "#4c8d70" },
];

const INITIAL_SIGNALS: Opportunity[] = [
  {
    id: 1,
    title: "Civic Futures Fellowship",
    organization: "Open Society Lab",
    type: "Fellowship",
    stage: "to-apply",
    deadline: "Aug 28",
    summary: "A twelve-week studio for people rethinking how cities share power.",
    priority: "high",
    progress: 62,
  },
  {
    id: 2,
    title: "Product systems, not screens",
    organization: "Northstar Design",
    type: "Role",
    stage: "interviewing",
    deadline: "Sep 02",
    summary: "Lead the design practice behind a new generation of civic software.",
    priority: "high",
    progress: 78,
  },
  {
    id: 3,
    title: "Small Signals Grant",
    organization: "The Good Work Fund",
    type: "Grant",
    stage: "to-apply",
    deadline: "Sep 11",
    summary: "Funding for independent research that makes everyday life more legible.",
    priority: "medium",
    progress: 34,
  },
  {
    id: 4,
    title: "Future of Work Assembly",
    organization: "Kite / Berlin",
    type: "Talk",
    stage: "applied",
    deadline: "Sep 19",
    summary: "A small-room gathering on the rituals and tools of useful work.",
    priority: "medium",
    progress: 51,
  },
  {
    id: 5,
    title: "The Long View residency",
    organization: "Kestrel House",
    type: "Residency",
    stage: "completed",
    deadline: "Closed Jun 14",
    summary: "A month to make one meaningful thing without explaining it too soon.",
    priority: "low",
    progress: 100,
  },
  {
    id: 6,
    title: "Atlas Research Sprint",
    organization: "Common Thread",
    type: "Contract",
    stage: "applied",
    deadline: "Sep 24",
    summary: "Map the invisible systems behind neighborhood-level resilience.",
    priority: "low",
    progress: 46,
  },
];

function ArrowIcon({ direction = "right" }: { direction?: "right" | "left" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d={direction === "right" ? "M3 10h13M11 5l5 5-5 5" : "M17 10H4M9 5l-5 5 5 5"}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="8.7" cy="8.7" r="4.8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.3 12.3 4.1 4.1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m10 2 1.25 5.75L17 10l-5.75 1.25L10 17l-1.25-5.75L3 10l5.75-2.25L10 2Z" fill="currentColor" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="3" y="3" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="12" y="3" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3" y="12" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <rect x="12" y="12" width="5" height="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m4.5 10.3 3.4 3.4 7.6-7.4" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StageMark({ stage }: { stage: Stage }) {
  const stageIndex = STAGES.findIndex((item) => item.key === stage);
  return (
    <span className="sdr-stage-mark" aria-label={`Stage: ${STAGES[stageIndex]?.label}`}>
      {STAGES.map((item, index) => (
        <i key={item.key} style={{ background: index <= stageIndex ? item.color : "rgba(41, 44, 52, .12)" }} />
      ))}
    </span>
  );
}

export function SignalDeskRefined() {
  const [signals, setSignals] = useState(INITIAL_SIGNALS);
  const [view, setView] = useState<ViewKey>("focus");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(2);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState("Focus queue is ready");
  const [quietMode, setQuietMode] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [newOrganization, setNewOrganization] = useState("");
  const [newType, setNewType] = useState("Opportunity");

  const selected = signals.find((item) => item.id === selectedId) ?? null;
  const active = signals.filter((item) => item.stage !== "completed");
  const urgent = active.filter((item) => item.priority === "high").length;
  const nextStage = selected
    ? STAGES[(STAGES.findIndex((stage) => stage.key === selected.stage) + 1) % STAGES.length]
    : null;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return signals.filter((item) => {
      const matchesView =
        view === "all" || (view === "done" ? item.stage === "completed" : item.stage !== "completed");
      const matchesSearch =
        !query || `${item.title} ${item.organization} ${item.type}`.toLowerCase().includes(query);
      return matchesView && matchesSearch;
    });
  }, [search, signals, view]);

  const setViewWithNotice = (nextView: ViewKey) => {
    setView(nextView);
    setNotice(nextView === "focus" ? "Focus queue selected" : nextView === "done" ? "Closed loop selected" : "All signals selected");
  };

  const advanceSelected = () => {
    if (!selected || !nextStage) return;
    setSignals((current) =>
      current.map((item) =>
        item.id === selected.id
          ? {
              ...item,
              stage: nextStage.key,
              progress: nextStage.key === "completed" ? 100 : Math.min(96, item.progress + 16),
            }
          : item,
      ),
    );
    setNotice(`${selected.title} moved to ${nextStage.label.toLowerCase()}`);
  };

  const addOpportunity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim() || !newOrganization.trim()) return;
    const created: Opportunity = {
      id: Date.now(),
      title: newTitle.trim(),
      organization: newOrganization.trim(),
      type: newType,
      stage: "to-apply",
      deadline: "No date yet",
      summary: "New signal added to your focus queue.",
      priority: "medium",
      progress: 12,
    };
    setSignals((current) => [created, ...current]);
    setSelectedId(created.id);
    setNewTitle("");
    setNewOrganization("");
    setNewType("Opportunity");
    setAddOpen(false);
    setNotice("New signal added to your orbit");
  };

  const closeDialog = () => {
    setAddOpen(false);
    setNewTitle("");
    setNewOrganization("");
    setNewType("Opportunity");
  };

  return (
    <div className="sdr-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Mono:wght@400;500&display=swap');
        .sdr-shell {
          --paper: #f5f2ea;
          --paper-deep: #eae5da;
          --paper-bright: #fbf9f3;
          --ink: #20242d;
          --ink-soft: #373b44;
          --muted: #787872;
          --line: rgba(32,36,45,.15);
          --line-strong: rgba(32,36,45,.28);
          --red: #eb6447;
          --lime: #d8e667;
          min-height: 100dvh;
          width: 100%;
          overflow: hidden;
          background: var(--paper);
          color: var(--ink);
          font-family: "Bricolage Grotesque", "Trebuchet MS", sans-serif;
        }
        .sdr-shell *, .sdr-shell *::before, .sdr-shell *::after { box-sizing: border-box; }
        .sdr-shell button, .sdr-shell input, .sdr-shell select { font: inherit; }
        .sdr-frame { min-height: 100dvh; display: grid; grid-template-columns: 72px minmax(0, 1fr); }
        .sdr-rail { display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 26px 0 22px; background: var(--ink); color: var(--paper); }
        .sdr-logo { width: 34px; height: 34px; display: grid; place-items: center; color: var(--ink); background: var(--lime); font-size: 14px; font-weight: 800; letter-spacing: -.1em; transform: rotate(-7deg); }
        .sdr-rail-nav { display: grid; gap: 14px; justify-items: center; }
        .sdr-rail-button { width: 39px; height: 39px; display: grid; place-items: center; border: 1px solid transparent; background: transparent; color: rgba(245,242,234,.43); cursor: pointer; transition: color .2s ease, border-color .2s ease, transform .2s ease; }
        .sdr-rail-button:hover, .sdr-rail-button.is-active { color: var(--lime); border-color: rgba(216,230,103,.58); transform: translateX(2px); }
        .sdr-rail-button svg { width: 17px; height: 17px; }
        .sdr-rail-index { color: rgba(245,242,234,.38); font-family: "DM Mono", monospace; font-size: 9px; writing-mode: vertical-rl; letter-spacing: .16em; }
        .sdr-main { min-width: 0; position: relative; padding: 30px clamp(20px, 4vw, 64px) 46px; }
        .sdr-main::before { content: ""; position: absolute; inset: 0; opacity: .38; pointer-events: none; background-image: radial-gradient(rgba(32,36,45,.1) .7px, transparent .7px); background-size: 7px 7px; mask-image: linear-gradient(135deg, rgba(0,0,0,.58), transparent 72%); }
        .sdr-content { max-width: 1530px; margin: 0 auto; position: relative; }
        .sdr-topline { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 23px; border-bottom: 1px solid var(--line); }
        .sdr-breadcrumb { display: flex; align-items: center; gap: 10px; color: var(--muted); font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
        .sdr-breadcrumb b { color: var(--red); font-size: 14px; }
        .sdr-top-actions { display: flex; align-items: center; gap: 14px; }
        .sdr-search { width: clamp(145px, 17vw, 230px); display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line); color: var(--muted); }
        .sdr-search svg { width: 15px; height: 15px; flex: 0 0 auto; }
        .sdr-search input { min-width: 0; width: 100%; padding: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: 12px; }
        .sdr-search input::placeholder { color: #96958e; }
        .sdr-add, .sdr-submit { display: inline-flex; align-items: center; justify-content: center; gap: 8px; border: 1px solid var(--ink); background: var(--ink); color: var(--paper); cursor: pointer; font-size: 11px; font-weight: 700; letter-spacing: .04em; transition: transform .2s ease, background .2s ease, border-color .2s ease; }
        .sdr-add { padding: 9px 13px; }
        .sdr-add:hover, .sdr-submit:hover { transform: translateY(-2px); background: var(--red); border-color: var(--red); }
        .sdr-add svg, .sdr-submit svg { width: 14px; height: 14px; }
        .sdr-heading { display: flex; align-items: end; justify-content: space-between; gap: 30px; padding: 42px 0 35px; }
        .sdr-kicker { margin: 0 0 12px; color: var(--red); font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; }
        .sdr-heading h1 { max-width: 700px; margin: 0; font-size: clamp(42px, 6.15vw, 91px); font-weight: 650; letter-spacing: -.077em; line-height: .88; }
        .sdr-heading h1 em { color: var(--red); font-style: normal; }
        .sdr-heading-note { max-width: 258px; margin: 0 0 3px; color: var(--muted); font-size: 13px; line-height: 1.45; }
        .sdr-heading-note strong { color: var(--ink); font-weight: 700; }
        .sdr-overview { display: grid; grid-template-columns: minmax(220px, 1.15fr) minmax(190px, .85fr) minmax(190px, .85fr) minmax(210px, 1fr); border-top: 1px solid var(--ink); border-bottom: 1px solid var(--line); }
        .sdr-metric { min-height: 110px; padding: 17px 20px 18px 0; border-right: 1px solid var(--line); }
        .sdr-metric + .sdr-metric { padding-left: 20px; }
        .sdr-metric:last-child { border-right: 0; }
        .sdr-metric-label { display: block; color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }
        .sdr-metric-value { display: block; margin-top: 13px; font-size: 37px; letter-spacing: -.07em; line-height: 1; }
        .sdr-metric-value small { margin-left: 4px; color: var(--muted); font-size: 12px; letter-spacing: 0; }
        .sdr-metric-accent { color: var(--red); }
        .sdr-progress { display: flex; gap: 4px; align-items: center; margin-top: 17px; }
        .sdr-progress i { height: 7px; flex: 1; background: var(--paper-deep); }
        .sdr-progress i:nth-child(-n+3) { background: var(--red); }
        .sdr-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(300px, 31%); gap: clamp(22px, 4vw, 58px); padding-top: 46px; }
        .sdr-list-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 17px; }
        .sdr-list-title { margin: 0; font-size: 25px; letter-spacing: -.05em; }
        .sdr-list-title span { color: var(--muted); font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: .07em; vertical-align: middle; }
        .sdr-view-tabs { display: flex; gap: 14px; }
        .sdr-view-tab { padding: 4px 0; border: 0; border-bottom: 1px solid transparent; background: transparent; color: var(--muted); cursor: pointer; font-family: "DM Mono", monospace; font-size: 9px; text-transform: uppercase; transition: color .2s ease, border-color .2s ease; }
        .sdr-view-tab:hover, .sdr-view-tab.is-active { color: var(--ink); border-color: var(--red); }
        .sdr-list { display: grid; gap: 9px; }
        .sdr-row { display: grid; grid-template-columns: 38px minmax(0, 1fr) 110px 104px 38px 28px; align-items: center; gap: 17px; min-height: 83px; padding: 13px 15px 13px 0; border-top: 1px solid var(--line); cursor: pointer; transition: padding .2s ease, background .2s ease; }
        .sdr-row:last-child { border-bottom: 1px solid var(--line); }
        .sdr-row:hover, .sdr-row.is-selected { padding-left: 13px; background: rgba(255,255,255,.47); }
        .sdr-row.is-selected { box-shadow: inset 3px 0 0 var(--red); }
        .sdr-row-number { color: var(--muted); font-family: "DM Mono", monospace; font-size: 10px; text-align: center; }
        .sdr-row h3 { overflow: hidden; margin: 0 0 4px; font-size: 16px; font-weight: 650; letter-spacing: -.035em; text-overflow: ellipsis; white-space: nowrap; }
        .sdr-row p { overflow: hidden; margin: 0; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
        .sdr-row-meta { color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; line-height: 1.5; text-transform: uppercase; }
        .sdr-row-meta b { display: block; color: var(--ink); font-family: "Bricolage Grotesque", sans-serif; font-size: 11px; font-weight: 500; text-transform: none; }
        .sdr-row-deadline { color: var(--ink); font-family: "DM Mono", monospace; font-size: 10px; }
        .sdr-row-deadline.urgent { color: var(--red); }
        .sdr-row-arrow { display: grid; place-items: center; width: 27px; height: 27px; color: var(--muted); border: 1px solid var(--line); border-radius: 50%; }
        .sdr-row-arrow svg { width: 13px; height: 13px; transition: transform .2s ease; }
        .sdr-row:hover .sdr-row-arrow svg, .sdr-row.is-selected .sdr-row-arrow svg { transform: translateX(2px); }
        .sdr-stage-mark { display: flex; gap: 2px; width: 38px; }
        .sdr-stage-mark i { display: block; width: 7px; height: 3px; }
        .sdr-empty { padding: 60px 20px; border: 1px dashed var(--line); color: var(--muted); font-size: 13px; text-align: center; }
        .sdr-focus { position: relative; min-height: 330px; padding: 24px 24px 22px; background: var(--ink); color: var(--paper); overflow: hidden; }
        .sdr-focus::after { content: "FOCUS"; position: absolute; right: -12px; bottom: -25px; color: rgba(245,242,234,.05); font-size: 105px; font-weight: 800; letter-spacing: -.11em; transform: rotate(-10deg); pointer-events: none; }
        .sdr-focus-top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; color: var(--lime); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .15em; text-transform: uppercase; }
        .sdr-focus-top span:last-child { color: rgba(245,242,234,.46); }
        .sdr-focus h2 { position: relative; z-index: 1; max-width: 360px; margin: 42px 0 8px; color: var(--paper); font-size: clamp(28px, 3vw, 46px); line-height: .92; letter-spacing: -.07em; }
        .sdr-focus-org { position: relative; z-index: 1; color: rgba(245,242,234,.6); font-size: 12px; }
        .sdr-focus-bottom { position: absolute; z-index: 1; right: 24px; bottom: 22px; left: 24px; display: flex; align-items: end; justify-content: space-between; gap: 15px; }
        .sdr-focus-copy { max-width: 190px; margin: 0; color: rgba(245,242,234,.62); font-size: 11px; line-height: 1.45; }
        .sdr-focus-cta { display: inline-flex; align-items: center; gap: 9px; padding: 10px 12px; border: 1px solid var(--lime); background: var(--lime); color: var(--ink); cursor: pointer; font-size: 10px; font-weight: 800; white-space: nowrap; transition: background .2s ease, color .2s ease; }
        .sdr-focus-cta:hover { background: transparent; color: var(--lime); }
        .sdr-focus-cta svg { width: 14px; height: 14px; }
        .sdr-side-block { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--line); }
        .sdr-side-label { display: flex; align-items: center; justify-content: space-between; color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }
        .sdr-side-label b { color: var(--ink); font-family: "Bricolage Grotesque", sans-serif; font-size: 13px; letter-spacing: 0; text-transform: none; }
        .sdr-radar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 15px; }
        .sdr-radar-item { display: grid; gap: 8px; min-height: 77px; padding: 9px; border: 1px solid var(--line); }
        .sdr-radar-item span { color: var(--muted); font-family: "DM Mono", monospace; font-size: 8px; line-height: 1.2; text-transform: uppercase; }
        .sdr-radar-item b { align-self: end; font-size: 22px; font-weight: 500; letter-spacing: -.08em; }
        .sdr-radar-item b::before { content: ""; display: inline-block; width: 6px; height: 6px; margin: 0 5px 3px 0; background: var(--dot); }
        .sdr-footer { display: flex; justify-content: space-between; gap: 20px; margin-top: 37px; color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
        .sdr-footer b { color: var(--ink); font-weight: 500; }
        .sdr-mode { display: inline-flex; align-items: center; gap: 7px; margin: 0; color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
        .sdr-mode button { width: 30px; height: 16px; padding: 2px; border: 1px solid var(--line-strong); border-radius: 20px; background: transparent; cursor: pointer; }
        .sdr-mode button span { display: block; width: 10px; height: 10px; border-radius: 50%; background: var(--muted); transition: transform .2s ease, background .2s ease; }
        .sdr-mode button.is-on span { background: var(--red); transform: translateX(13px); }
        .sdr-notice { position: fixed; z-index: 20; right: 24px; bottom: 22px; padding: 10px 13px; border: 1px solid var(--ink); background: var(--lime); color: var(--ink); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .03em; animation: sdr-in .28s ease both; }
        .sdr-notice button { margin-left: 10px; padding: 0; border: 0; background: transparent; color: inherit; cursor: pointer; }
        @keyframes sdr-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .sdr-modal-wrap { position: fixed; z-index: 30; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(32,36,45,.62); }
        .sdr-modal { width: min(100%, 480px); padding: 25px; background: var(--paper-bright); box-shadow: 0 25px 80px rgba(20,20,24,.28); }
        .sdr-modal-head { display: flex; align-items: start; justify-content: space-between; gap: 15px; }
        .sdr-modal-kicker { margin: 0 0 8px; color: var(--red); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .15em; text-transform: uppercase; }
        .sdr-modal h2 { margin: 0; font-size: 30px; letter-spacing: -.06em; }
        .sdr-modal-close { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--line); background: transparent; color: var(--ink); cursor: pointer; }
        .sdr-modal-close svg { width: 15px; height: 15px; }
        .sdr-form { display: grid; gap: 14px; margin-top: 27px; }
        .sdr-form label { display: grid; gap: 6px; color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .09em; text-transform: uppercase; }
        .sdr-form input, .sdr-form select { width: 100%; padding: 11px 0; border: 0; border-bottom: 1px solid var(--line); outline: none; background: transparent; color: var(--ink); font-size: 16px; }
        .sdr-form select { border-radius: 0; cursor: pointer; }
        .sdr-form input:focus, .sdr-form select:focus { border-color: var(--red); }
        .sdr-submit { justify-self: start; margin-top: 7px; padding: 11px 14px; }
        @media (max-width: 960px) {
          .sdr-body { grid-template-columns: 1fr; }
          .sdr-focus { min-height: 270px; }
        }
        @media (max-width: 720px) {
          .sdr-frame { display: block; }
          .sdr-rail { height: 58px; flex-direction: row; padding: 0 18px; }
          .sdr-rail-nav { display: flex; gap: 4px; }
          .sdr-rail-button { width: 35px; height: 35px; }
          .sdr-index-hide { display: none; }
          .sdr-main { padding: 20px 17px 35px; }
          .sdr-topline { align-items: flex-start; flex-direction: column; padding-bottom: 18px; }
          .sdr-top-actions { width: 100%; }
          .sdr-search { flex: 1; width: auto; }
          .sdr-heading { display: block; padding: 31px 0 27px; }
          .sdr-heading-note { margin-top: 19px; }
          .sdr-overview { grid-template-columns: 1fr 1fr; }
          .sdr-metric { min-height: 92px; padding: 13px 12px 14px 0; }
          .sdr-metric + .sdr-metric { padding-left: 12px; }
          .sdr-metric:nth-child(2) { border-right: 0; }
          .sdr-metric:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
          .sdr-metric-value { margin-top: 9px; font-size: 30px; }
          .sdr-body { padding-top: 32px; }
          .sdr-list-head { align-items: flex-start; flex-direction: column; gap: 11px; }
          .sdr-row { grid-template-columns: 25px minmax(0,1fr) 25px; gap: 9px; }
          .sdr-row .sdr-row-meta, .sdr-row .sdr-row-deadline, .sdr-row .sdr-stage-mark { display: none; }
          .sdr-row h3 { font-size: 15px; }
          .sdr-footer { display: block; line-height: 2; }
          .sdr-footer .sdr-mode { margin-top: 9px; }
        }
      `}</style>

      <div className="sdr-frame">
        <aside className="sdr-rail" aria-label="Workspace navigation">
          <div className="sdr-logo" aria-label="Signal Desk">S/</div>
          <nav className="sdr-rail-nav">
            <button
              className={`sdr-rail-button${view === "focus" ? " is-active" : ""}`}
              type="button"
              aria-label="Focus queue"
              onClick={() => setViewWithNotice("focus")}
            >
              <SparkIcon />
            </button>
            <button
              className={`sdr-rail-button${view === "all" ? " is-active" : ""}`}
              type="button"
              aria-label="All opportunities"
              onClick={() => setViewWithNotice("all")}
            >
              <GridIcon />
            </button>
            <button
              className={`sdr-rail-button${view === "done" ? " is-active" : ""}`}
              type="button"
              aria-label="Closed opportunities"
              onClick={() => setViewWithNotice("done")}
            >
              <CheckIcon />
            </button>
          </nav>
          <span className="sdr-rail-index sdr-index-hide">M / 02</span>
        </aside>

        <main className="sdr-main">
          <div className="sdr-content">
            <header className="sdr-topline">
              <div className="sdr-breadcrumb"><b>●</b><span>Melizza / workspace</span><span>/</span><span>Signal desk</span></div>
              <div className="sdr-top-actions">
                <label className="sdr-search">
                  <SearchIcon />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search signals" aria-label="Search signals" />
                </label>
                <button className="sdr-add" type="button" onClick={() => setAddOpen(true)}><PlusIcon /> Add signal</button>
              </div>
            </header>

            <section className="sdr-heading">
              <div>
                <p className="sdr-kicker">Thursday / 22 August 2024</p>
                <h1>Make room for the <em>next move.</em></h1>
              </div>
              <p className="sdr-heading-note"><strong>Signal Desk</strong> keeps possibility visible without turning it into noise. Pick one thing, move it one step.</p>
            </section>

            <section className="sdr-overview" aria-label="Opportunity overview">
              <div className="sdr-metric">
                <span className="sdr-metric-label">In orbit</span>
                <span className="sdr-metric-value">{active.length}<small>active signals</small></span>
                <div className="sdr-progress" aria-hidden="true"><i /><i /><i /><i /><i /></div>
              </div>
              <div className="sdr-metric">
                <span className="sdr-metric-label">Needs a move</span>
                <span className="sdr-metric-value sdr-metric-accent">{urgent}<small>high priority</small></span>
              </div>
              <div className="sdr-metric">
                <span className="sdr-metric-label">In conversation</span>
                <span className="sdr-metric-value">{signals.filter((item) => item.stage === "interviewing").length}<small>open threads</small></span>
              </div>
              <div className="sdr-metric">
                <span className="sdr-metric-label">This week's rhythm</span>
                <span className="sdr-metric-value">3<small>moves made</small></span>
              </div>
            </section>

            <div className="sdr-body">
              <section>
                <div className="sdr-list-head">
                  <h2 className="sdr-list-title">
                    {view === "focus" ? "Focus queue" : view === "done" ? "Closed loop" : "All signals"}{" "}
                    <span>{String(visible.length).padStart(2, "0")}</span>
                  </h2>
                  <div className="sdr-view-tabs" role="tablist" aria-label="Opportunity views">
                    {(["focus", "all", "done"] as ViewKey[]).map((item) => (
                      <button key={item} className={`sdr-view-tab${view === item ? " is-active" : ""}`} type="button" role="tab" aria-selected={view === item} onClick={() => setViewWithNotice(item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="sdr-list">
                  {visible.length === 0 ? (
                    <div className="sdr-empty">No signals match this view. Try another orbit.</div>
                  ) : visible.map((item, index) => (
                    <article
                      key={item.id}
                      className={`sdr-row${selectedId === item.id ? " is-selected" : ""}`}
                      onClick={() => setSelectedId(item.id)}
                      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedId(item.id); }}
                      role="button"
                      tabIndex={0}
                      aria-label={`Select ${item.title}`}
                    >
                      <div className="sdr-row-number">{String(index + 1).padStart(2, "0")}</div>
                      <div><h3>{item.title}</h3><p>{item.organization} · {item.summary}</p></div>
                      <div className="sdr-row-meta"><b>{item.type}</b>{item.priority} priority</div>
                      <div className={`sdr-row-deadline${item.priority === "high" ? " urgent" : ""}`}>{item.deadline}</div>
                      <div className="sdr-row-arrow"><ArrowIcon /></div>
                      <StageMark stage={item.stage} />
                    </article>
                  ))}
                </div>
              </section>

              <aside>
                <section className="sdr-focus" aria-label="Selected opportunity">
                  {selected ? (
                    <>
                      <div className="sdr-focus-top"><span>Now in focus</span><span>{selected.progress}% aligned</span></div>
                      <h2>{selected.title}</h2>
                      <div className="sdr-focus-org">{selected.organization} / {selected.type}</div>
                      <div className="sdr-focus-bottom">
                        <p className="sdr-focus-copy">{selected.summary}</p>
                        <button className="sdr-focus-cta" type="button" onClick={advanceSelected}>
                          Move to {nextStage?.short}
                          <ArrowIcon />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="sdr-focus-top"><span>Choose a signal</span></div>
                  )}
                </section>
                <section className="sdr-side-block">
                  <div className="sdr-side-label"><span>Pipeline pulse</span><b>by stage</b></div>
                  <div className="sdr-radar">
                    {STAGES.map((stage) => (
                      <div className="sdr-radar-item" key={stage.key} style={{ "--dot": stage.color } as CSSProperties}>
                        <span>{stage.label}</span>
                        <b>{signals.filter((item) => item.stage === stage.key).length}</b>
                      </div>
                    ))}
                  </div>
                </section>
              </aside>
            </div>

            <footer className="sdr-footer">
              <span>Last synced 09:41 <b>·</b> quiet mode {quietMode ? "on" : "off"}</span>
              <label className="sdr-mode">
                Quiet mode
                <button type="button" className={quietMode ? "is-on" : ""} aria-label="Toggle quiet mode" aria-pressed={quietMode} onClick={() => { setQuietMode((current) => !current); setNotice(`Quiet mode ${quietMode ? "off" : "on"}`); }}>
                  <span />
                </button>
              </label>
            </footer>
          </div>
        </main>
      </div>

      {notice && (
        <div className="sdr-notice" key={notice}>
          {notice}
          <button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")}><CloseIcon /></button>
        </div>
      )}

      {addOpen && (
        <div className="sdr-modal-wrap" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog(); }}>
          <section className="sdr-modal" role="dialog" aria-modal="true" aria-labelledby="sdr-modal-title">
            <div className="sdr-modal-head">
              <div><p className="sdr-modal-kicker">New signal / 02</p><h2 id="sdr-modal-title">Put it on the map.</h2></div>
              <button className="sdr-modal-close" type="button" aria-label="Close add signal dialog" onClick={closeDialog}><CloseIcon /></button>
            </div>
            <form className="sdr-form" onSubmit={addOpportunity}>
              <label>What is the opportunity?<input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="A role, grant, room..." required /></label>
              <label>Who is it with?<input value={newOrganization} onChange={(event) => setNewOrganization(event.target.value)} placeholder="Organization or person" required /></label>
              <label>What kind of signal?<select value={newType} onChange={(event) => setNewType(event.target.value)}><option>Opportunity</option><option>Role</option><option>Grant</option><option>Fellowship</option><option>Talk</option></select></label>
              <button className="sdr-submit" type="submit">Add to focus queue <ArrowIcon /></button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default SignalDeskRefined;