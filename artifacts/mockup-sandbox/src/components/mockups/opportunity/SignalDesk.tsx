import { useMemo, useState, type CSSProperties, type FormEvent } from "react";

type Stage = "to-apply" | "applied" | "interviewing" | "completed";
type ViewKey = "focus" | "all" | "done";

type Opportunity = {
  id: number;
  title: string;
  organization: string;
  type: string;
  stage: Stage;
  deadline: string;
  summary: string;
  priority: "high" | "medium" | "low";
  progress: number;
};

const STAGES: { key: Stage; label: string; color: string }[] = [
  { key: "to-apply", label: "To apply", color: "#ef5b42" },
  { key: "applied", label: "Applied", color: "#e3a72f" },
  { key: "interviewing", label: "In conversation", color: "#3667d6" },
  { key: "completed", label: "Closed", color: "#39866a" },
];

const STARTING_OPPORTUNITIES: Opportunity[] = [
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
      <path d={direction === "right" ? "M3 10h13M11 5l5 5-5 5" : "M17 10H4M9 5l-5 5 5 5"} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
    <span className="signal-stage-mark" aria-hidden="true">
      {STAGES.map((item, index) => (
        <i key={item.key} style={{ background: index <= stageIndex ? item.color : "rgba(38, 42, 52, .13)" }} />
      ))}
    </span>
  );
}

export function SignalDesk() {
  const [opportunities, setOpportunities] = useState(STARTING_OPPORTUNITIES);
  const [view, setView] = useState<ViewKey>("focus");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(2);
  const [addOpen, setAddOpen] = useState(false);
  const [notice, setNotice] = useState("6 signals in orbit");
  const [newTitle, setNewTitle] = useState("");
  const [newOrganization, setNewOrganization] = useState("");

  const selected = opportunities.find((item) => item.id === selectedId) ?? null;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return opportunities.filter((item) => {
      const matchesView = view === "all" || (view === "done" ? item.stage === "completed" : item.stage !== "completed");
      const matchesSearch = !query || `${item.title} ${item.organization} ${item.type}`.toLowerCase().includes(query);
      return matchesView && matchesSearch;
    });
  }, [opportunities, search, view]);

  const active = opportunities.filter((item) => item.stage !== "completed");
  const urgent = active.filter((item) => item.priority === "high").length;
  const nextStage = selected ? STAGES[(STAGES.findIndex((stage) => stage.key === selected.stage) + 1) % STAGES.length] : null;

  const advanceSelected = () => {
    if (!selected || !nextStage) return;
    setOpportunities((current) => current.map((item) => item.id === selected.id ? { ...item, stage: nextStage.key, progress: nextStage.key === "completed" ? 100 : Math.min(96, item.progress + 16) } : item));
    setNotice(`${selected.title} moved to ${nextStage.label.toLowerCase()}`);
  };

  const addOpportunity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newTitle.trim() || !newOrganization.trim()) return;
    const created: Opportunity = {
      id: Date.now(),
      title: newTitle.trim(),
      organization: newOrganization.trim(),
      type: "Opportunity",
      stage: "to-apply",
      deadline: "No date yet",
      summary: "New signal added to your focus queue.",
      priority: "medium",
      progress: 12,
    };
    setOpportunities((current) => [created, ...current]);
    setSelectedId(created.id);
    setNewTitle("");
    setNewOrganization("");
    setAddOpen(false);
    setNotice("New signal added to your orbit");
  };

  return (
    <div className="signal-shell">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400..800&family=DM+Mono:wght@400;500&display=swap');
        .signal-shell {
          --paper: #f4f1e9;
          --paper-deep: #e9e4d9;
          --ink: #20232c;
          --muted: #73736d;
          --line: rgba(32,35,44,.15);
          --red: #ef5b42;
          min-height: 100dvh; width: 100%; overflow: hidden;
          background: var(--paper); color: var(--ink);
          font-family: "Bricolage Grotesque", "Trebuchet MS", sans-serif;
        }
        .signal-shell *, .signal-shell *::before, .signal-shell *::after { box-sizing: border-box; }
        .signal-shell button, .signal-shell input { font: inherit; }
        .signal-frame { min-height: 100dvh; display: grid; grid-template-columns: 72px minmax(0, 1fr); position: relative; }
        .signal-rail { background: #20232c; color: #f4f1e9; display: flex; flex-direction: column; align-items: center; justify-content: space-between; padding: 26px 0 22px; }
        .signal-logo { width: 33px; height: 33px; display: grid; place-items: center; color: #20232c; background: #d8e667; font-size: 14px; font-weight: 800; letter-spacing: -.08em; transform: rotate(-7deg); }
        .signal-rail-nav { display: grid; gap: 16px; justify-items: center; }
        .signal-rail-button { width: 38px; height: 38px; display: grid; place-items: center; border: 1px solid transparent; background: transparent; color: rgba(244,241,233,.45); cursor: pointer; transition: color .2s ease, border-color .2s ease, transform .2s ease; }
        .signal-rail-button:hover, .signal-rail-button.is-active { color: #d8e667; border-color: rgba(216,230,103,.55); transform: translateX(2px); }
        .signal-rail-button svg { width: 17px; height: 17px; }
        .signal-rail-index { color: rgba(244,241,233,.4); font-family: "DM Mono", monospace; font-size: 9px; writing-mode: vertical-rl; letter-spacing: .16em; }
        .signal-main { min-width: 0; padding: 30px clamp(20px, 4vw, 64px) 46px; position: relative; }
        .signal-main::before { content: ""; position: absolute; inset: 0; opacity: .35; pointer-events: none; background-image: radial-gradient(rgba(32,35,44,.09) .7px, transparent .7px); background-size: 7px 7px; mask-image: linear-gradient(135deg, rgba(0,0,0,.6), transparent 70%); }
        .signal-content { max-width: 1530px; margin: 0 auto; position: relative; }
        .signal-topline { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 24px; border-bottom: 1px solid var(--line); }
        .signal-breadcrumb { display: flex; align-items: center; gap: 11px; color: var(--muted); font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: .12em; text-transform: uppercase; }
        .signal-breadcrumb b { color: var(--red); font-size: 15px; }
        .signal-top-actions { display: flex; align-items: center; gap: 12px; }
        .signal-search { width: clamp(140px, 17vw, 230px); display: flex; align-items: center; gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line); color: var(--muted); }
        .signal-search svg { width: 15px; height: 15px; flex: 0 0 auto; }
        .signal-search input { min-width: 0; width: 100%; padding: 0; border: 0; outline: 0; background: transparent; color: var(--ink); font-size: 12px; }
        .signal-search input::placeholder { color: #96958e; }
        .signal-add { display: inline-flex; align-items: center; gap: 8px; padding: 9px 13px; border: 1px solid var(--ink); background: var(--ink); color: var(--paper); cursor: pointer; font-size: 11px; font-weight: 700; letter-spacing: .04em; transition: transform .2s ease, background .2s ease; }
        .signal-add:hover { transform: translateY(-2px); background: var(--red); border-color: var(--red); }
        .signal-add svg { width: 14px; height: 14px; }
        .signal-heading { display: flex; align-items: end; justify-content: space-between; gap: 30px; padding: 42px 0 36px; }
        .signal-kicker { margin: 0 0 12px; color: var(--red); font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; }
        .signal-heading h1 { max-width: 690px; margin: 0; font-size: clamp(42px, 6.2vw, 92px); font-weight: 650; letter-spacing: -.075em; line-height: .88; }
        .signal-heading h1 em { color: var(--red); font-style: normal; }
        .signal-heading-note { max-width: 250px; margin: 0 0 3px; color: var(--muted); font-size: 13px; line-height: 1.42; }
        .signal-heading-note strong { color: var(--ink); font-weight: 700; }
        .signal-overview { display: grid; grid-template-columns: minmax(220px, 1.15fr) minmax(190px, .85fr) minmax(190px, .85fr) minmax(210px, 1fr); border-top: 1px solid var(--ink); border-bottom: 1px solid var(--line); }
        .signal-metric { min-height: 110px; padding: 17px 20px 18px 0; border-right: 1px solid var(--line); }
        .signal-metric + .signal-metric { padding-left: 20px; }
        .signal-metric:last-child { border-right: 0; }
        .signal-metric-label { display: block; color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }
        .signal-metric-value { display: block; margin-top: 13px; font-size: 37px; letter-spacing: -.07em; line-height: 1; }
        .signal-metric-value small { margin-left: 4px; color: var(--muted); font-size: 12px; letter-spacing: 0; }
        .signal-metric-accent { color: var(--red); }
        .signal-progress { display: flex; gap: 4px; align-items: center; margin-top: 17px; }
        .signal-progress i { height: 7px; flex: 1; background: var(--paper-deep); }
        .signal-progress i:nth-child(-n+3) { background: var(--red); }
        .signal-body { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 31%); gap: clamp(22px, 4vw, 58px); padding-top: 46px; }
        .signal-list-head { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 17px; }
        .signal-list-title { margin: 0; font-size: 25px; letter-spacing: -.05em; }
        .signal-list-title span { color: var(--muted); font-family: "DM Mono", monospace; font-size: 10px; letter-spacing: .07em; vertical-align: middle; }
        .signal-view-tabs { display: flex; gap: 14px; }
        .signal-view-tab { padding: 4px 0; border: 0; border-bottom: 1px solid transparent; background: transparent; color: var(--muted); cursor: pointer; font-family: "DM Mono", monospace; font-size: 9px; text-transform: uppercase; }
        .signal-view-tab:hover, .signal-view-tab.is-active { color: var(--ink); border-color: var(--red); }
        .signal-list { display: grid; gap: 9px; }
        .signal-row { display: grid; grid-template-columns: 38px minmax(0, 1fr) 110px 104px 38px 28px; align-items: center; gap: 17px; min-height: 83px; padding: 13px 15px 13px 0; border-top: 1px solid var(--line); cursor: pointer; transition: padding .2s ease, background .2s ease; }
        .signal-row:last-child { border-bottom: 1px solid var(--line); }
        .signal-row:hover, .signal-row.is-selected { padding-left: 13px; background: rgba(255,255,255,.42); }
        .signal-row.is-selected { box-shadow: inset 3px 0 0 var(--red); }
        .signal-row-number { color: var(--muted); font-family: "DM Mono", monospace; font-size: 10px; text-align: center; }
        .signal-row h3 { overflow: hidden; margin: 0 0 4px; font-size: 16px; font-weight: 650; letter-spacing: -.035em; text-overflow: ellipsis; white-space: nowrap; }
        .signal-row p { overflow: hidden; margin: 0; color: var(--muted); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
        .signal-row-meta { color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; line-height: 1.5; text-transform: uppercase; }
        .signal-row-meta b { display: block; color: var(--ink); font-family: "Bricolage Grotesque", sans-serif; font-size: 11px; font-weight: 500; text-transform: none; }
        .signal-row-deadline { color: var(--ink); font-family: "DM Mono", monospace; font-size: 10px; }
        .signal-row-deadline.urgent { color: var(--red); }
        .signal-row-arrow { display: grid; place-items: center; width: 27px; height: 27px; color: var(--muted); border: 1px solid var(--line); border-radius: 50%; }
        .signal-row-arrow svg { width: 13px; height: 13px; transition: transform .2s ease; }
        .signal-row:hover .signal-row-arrow svg, .signal-row.is-selected .signal-row-arrow svg { transform: translateX(2px); }
        .signal-stage-mark { display: flex; gap: 2px; width: 38px; }
        .signal-stage-mark i { display: block; width: 7px; height: 3px; }
        .signal-empty { padding: 60px 20px; border: 1px dashed var(--line); color: var(--muted); font-size: 13px; text-align: center; }
        .signal-focus { position: relative; min-height: 330px; padding: 24px 24px 22px; background: var(--ink); color: var(--paper); overflow: hidden; }
        .signal-focus::after { content: "FOCUS"; position: absolute; right: -12px; bottom: -25px; color: rgba(244,241,233,.05); font-size: 105px; font-weight: 800; letter-spacing: -.11em; transform: rotate(-10deg); pointer-events: none; }
        .signal-focus-top { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; color: #d8e667; font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .15em; text-transform: uppercase; }
        .signal-focus-top span:last-child { color: rgba(244,241,233,.46); }
        .signal-focus h2 { position: relative; z-index: 1; max-width: 360px; margin: 42px 0 8px; font-size: clamp(28px, 3vw, 46px); line-height: .92; letter-spacing: -.07em; }
        .signal-focus-org { position: relative; z-index: 1; color: rgba(244,241,233,.6); font-size: 12px; }
        .signal-focus-bottom { position: absolute; z-index: 1; right: 24px; bottom: 22px; left: 24px; display: flex; align-items: end; justify-content: space-between; gap: 15px; }
        .signal-focus-copy { max-width: 190px; margin: 0; color: rgba(244,241,233,.62); font-size: 11px; line-height: 1.45; }
        .signal-focus-cta { display: inline-flex; align-items: center; gap: 9px; padding: 10px 12px; border: 1px solid #d8e667; background: #d8e667; color: var(--ink); cursor: pointer; font-size: 10px; font-weight: 800; white-space: nowrap; transition: background .2s ease, color .2s ease; }
        .signal-focus-cta:hover { background: transparent; color: #d8e667; }
        .signal-focus-cta svg { width: 14px; height: 14px; }
        .signal-side-block { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--line); }
        .signal-side-label { display: flex; align-items: center; justify-content: space-between; color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .12em; text-transform: uppercase; }
        .signal-side-label b { color: var(--ink); font-family: "Bricolage Grotesque", sans-serif; font-size: 13px; letter-spacing: 0; text-transform: none; }
        .signal-radar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 7px; margin-top: 15px; }
        .signal-radar-item { display: grid; gap: 8px; min-height: 77px; padding: 9px; border: 1px solid var(--line); }
        .signal-radar-item span { color: var(--muted); font-family: "DM Mono", monospace; font-size: 8px; line-height: 1.2; text-transform: uppercase; }
        .signal-radar-item b { align-self: end; font-size: 22px; font-weight: 500; letter-spacing: -.08em; }
        .signal-radar-item b::before { content: ""; display: inline-block; width: 6px; height: 6px; margin: 0 5px 3px 0; background: var(--dot); }
        .signal-footer { display: flex; justify-content: space-between; gap: 20px; margin-top: 37px; color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .08em; text-transform: uppercase; }
        .signal-footer b { color: var(--ink); font-weight: 500; }
        .signal-notice { position: fixed; z-index: 20; right: 24px; bottom: 22px; padding: 10px 13px; border: 1px solid var(--ink); background: #d8e667; color: var(--ink); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .03em; animation: signal-in .28s ease both; }
        @keyframes signal-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .signal-modal-wrap { position: fixed; z-index: 30; inset: 0; display: grid; place-items: center; padding: 20px; background: rgba(32,35,44,.62); }
        .signal-modal { width: min(100%, 470px); padding: 25px; background: var(--paper); box-shadow: 0 25px 80px rgba(20,20,24,.28); }
        .signal-modal-head { display: flex; align-items: start; justify-content: space-between; gap: 15px; }
        .signal-modal-kicker { margin: 0 0 8px; color: var(--red); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .15em; text-transform: uppercase; }
        .signal-modal h2 { margin: 0; font-size: 30px; letter-spacing: -.06em; }
        .signal-modal-close { display: grid; place-items: center; width: 28px; height: 28px; border: 1px solid var(--line); background: transparent; color: var(--ink); cursor: pointer; }
        .signal-modal-close svg { width: 15px; height: 15px; }
        .signal-form { display: grid; gap: 14px; margin-top: 27px; }
        .signal-form label { display: grid; gap: 6px; color: var(--muted); font-family: "DM Mono", monospace; font-size: 9px; letter-spacing: .09em; text-transform: uppercase; }
        .signal-form input { padding: 11px 0; border: 0; border-bottom: 1px solid var(--line); outline: none; background: transparent; color: var(--ink); font-size: 16px; }
        .signal-form input:focus { border-color: var(--red); }
        .signal-submit { justify-self: start; display: inline-flex; align-items: center; gap: 9px; margin-top: 7px; padding: 11px 14px; border: 1px solid var(--ink); background: var(--ink); color: var(--paper); cursor: pointer; font-size: 11px; font-weight: 700; }
        .signal-submit:hover { border-color: var(--red); background: var(--red); }
        @media (max-width: 960px) {
          .signal-body { grid-template-columns: 1fr; }
          .signal-focus { min-height: 270px; }
        }
        @media (max-width: 720px) {
          .signal-frame { display: block; }
          .signal-rail { height: 58px; flex-direction: row; padding: 0 18px; }
          .signal-rail-nav { display: flex; gap: 4px; }
          .signal-rail-button { width: 35px; height: 35px; }
          .signal-index-hide { display: none; }
          .signal-main { padding: 20px 17px 35px; }
          .signal-topline { align-items: flex-start; flex-direction: column; padding-bottom: 18px; }
          .signal-top-actions { width: 100%; }
          .signal-search { flex: 1; width: auto; }
          .signal-heading { display: block; padding: 31px 0 27px; }
          .signal-heading-note { margin-top: 19px; }
          .signal-overview { grid-template-columns: 1fr 1fr; }
          .signal-metric { min-height: 92px; padding: 13px 12px 14px 0; }
          .signal-metric + .signal-metric { padding-left: 12px; }
          .signal-metric:nth-child(2) { border-right: 0; }
          .signal-metric:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
          .signal-metric-value { margin-top: 9px; font-size: 30px; }
          .signal-body { padding-top: 32px; }
          .signal-list-head { align-items: flex-start; flex-direction: column; gap: 11px; }
          .signal-row { grid-template-columns: 25px minmax(0,1fr) 25px; gap: 9px; }
          .signal-row .signal-row-meta, .signal-row .signal-row-deadline, .signal-row .signal-stage-mark { display: none; }
          .signal-row h3 { font-size: 15px; }
          .signal-footer { display: block; line-height: 2; }
        }
      `}</style>

      <div className="signal-frame">
        <aside className="signal-rail" aria-label="Workspace navigation">
          <div className="signal-logo" aria-label="Signal Desk">S/</div>
          <nav className="signal-rail-nav">
            <button className="signal-rail-button is-active" type="button" aria-label="Focus queue" onClick={() => { setView("focus"); setNotice("Focus queue selected"); }}>
              <SparkIcon />
            </button>
            <button className="signal-rail-button" type="button" aria-label="All opportunities" onClick={() => { setView("all"); setNotice("All signals selected"); }}>
              <span style={{ fontFamily: '"DM Mono", monospace', fontSize: 11 }}>04</span>
            </button>
            <button className="signal-rail-button" type="button" aria-label="Closed opportunities" onClick={() => { setView("done"); setNotice("Closed signals selected"); }}>
              <span style={{ width: 15, height: 15, border: "1px solid currentColor", borderRadius: "50%" }} />
            </button>
          </nav>
          <span className="signal-rail-index">M / 01</span>
        </aside>

        <main className="signal-main">
          <div className="signal-content">
            <header className="signal-topline">
              <div className="signal-breadcrumb"><b>●</b><span>Melizza / workspace</span><span>/</span><span>Signal desk</span></div>
              <div className="signal-top-actions">
                <label className="signal-search">
                  <SearchIcon />
                  <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search signals" aria-label="Search signals" />
                </label>
                <button className="signal-add" type="button" onClick={() => setAddOpen(true)}><PlusIcon /> Add signal</button>
              </div>
            </header>

            <section className="signal-heading">
              <div>
                <p className="signal-kicker">Thursday / 22 August 2024</p>
                <h1>Make room for the <em>next move.</em></h1>
              </div>
              <p className="signal-heading-note"><strong>Signal Desk</strong> is a quieter way to keep possibility visible. Choose one thing, move it one step.</p>
            </section>

            <section className="signal-overview" aria-label="Opportunity overview">
              <div className="signal-metric">
                <span className="signal-metric-label">In orbit</span>
                <span className="signal-metric-value">{active.length}<small>active signals</small></span>
                <div className="signal-progress" aria-hidden="true"><i /><i /><i /><i /><i /></div>
              </div>
              <div className="signal-metric">
                <span className="signal-metric-label">Needs a move</span>
                <span className="signal-metric-value signal-metric-accent">{urgent}<small>high priority</small></span>
              </div>
              <div className="signal-metric">
                <span className="signal-metric-label">In conversation</span>
                <span className="signal-metric-value">{opportunities.filter((item) => item.stage === "interviewing").length}<small>open threads</small></span>
              </div>
              <div className="signal-metric">
                <span className="signal-metric-label">This week's rhythm</span>
                <span className="signal-metric-value">3<small>moves made</small></span>
              </div>
            </section>

            <div className="signal-body">
              <section>
                <div className="signal-list-head">
                  <h2 className="signal-list-title">{view === "focus" ? "Focus queue" : view === "done" ? "Closed loop" : "All signals"} <span>{String(visible.length).padStart(2, "0")}</span></h2>
                  <div className="signal-view-tabs" role="tablist" aria-label="Opportunity views">
                    {(["focus", "all", "done"] as ViewKey[]).map((item) => (
                      <button key={item} className={`signal-view-tab${view === item ? " is-active" : ""}`} type="button" role="tab" aria-selected={view === item} onClick={() => setView(item)}>{item}</button>
                    ))}
                  </div>
                </div>
                <div className="signal-list">
                  {visible.length === 0 ? (
                    <div className="signal-empty">No signals match this view. Try another orbit.</div>
                  ) : visible.map((item, index) => (
                    <article key={item.id} className={`signal-row${selectedId === item.id ? " is-selected" : ""}`} onClick={() => setSelectedId(item.id)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedId(item.id); }} role="button" tabIndex={0}>
                      <div className="signal-row-number">{String(index + 1).padStart(2, "0")}</div>
                      <div><h3>{item.title}</h3><p>{item.organization} · {item.summary}</p></div>
                      <div className="signal-row-meta"><b>{item.type}</b>{item.priority} priority</div>
                      <div className={`signal-row-deadline${item.priority === "high" ? " urgent" : ""}`}>{item.deadline}</div>
                      <div className="signal-row-arrow"><ArrowIcon /></div>
                      <StageMark stage={item.stage} />
                    </article>
                  ))}
                </div>
              </section>

              <aside>
                <section className="signal-focus" aria-label="Selected opportunity">
                  {selected ? (
                    <>
                      <div className="signal-focus-top"><span>Now in focus</span><span>{selected.progress}% aligned</span></div>
                      <h2>{selected.title}</h2>
                      <div className="signal-focus-org">{selected.organization} / {selected.type}</div>
                      <div className="signal-focus-bottom">
                        <p className="signal-focus-copy">{selected.summary}</p>
                        <button className="signal-focus-cta" type="button" onClick={advanceSelected}>Move to {nextStage?.label}<ArrowIcon /></button>
                      </div>
                    </>
                  ) : <div className="signal-focus-top"><span>Choose a signal</span></div>}
                </section>
                <section className="signal-side-block">
                  <div className="signal-side-label"><span>Pipeline pulse</span><b>by stage</b></div>
                  <div className="signal-radar">
                    {STAGES.map((stage) => <div className="signal-radar-item" key={stage.key} style={{ "--dot": stage.color } as CSSProperties}><span>{stage.label}</span><b>{opportunities.filter((item) => item.stage === stage.key).length}</b></div>)}
                  </div>
                </section>
              </aside>
            </div>

            <footer className="signal-footer"><span>Last synced 09:41 <b>·</b> quiet mode on</span><span>Keep the thread warm <b>↗</b></span></footer>
          </div>
        </main>
      </div>

      {notice && <div className="signal-notice" key={notice}>{notice}<button type="button" aria-label="Dismiss notice" onClick={() => setNotice("")} style={{ marginLeft: 10, padding: 0, border: 0, background: "transparent", cursor: "pointer", color: "inherit" }}>×</button></div>}

      {addOpen && (
        <div className="signal-modal-wrap" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setAddOpen(false); }}>
          <section className="signal-modal" role="dialog" aria-modal="true" aria-labelledby="signal-modal-title">
            <div className="signal-modal-head">
              <div><p className="signal-modal-kicker">New signal / 01</p><h2 id="signal-modal-title">Put it on the map.</h2></div>
              <button className="signal-modal-close" type="button" aria-label="Close add signal dialog" onClick={() => setAddOpen(false)}><CloseIcon /></button>
            </div>
            <form className="signal-form" onSubmit={addOpportunity}>
              <label>What is the opportunity?<input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="A role, grant, room..." required /></label>
              <label>Who is it with?<input value={newOrganization} onChange={(event) => setNewOrganization(event.target.value)} placeholder="Organization or person" required /></label>
              <button className="signal-submit" type="submit">Add to focus queue <ArrowIcon /></button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default SignalDesk;