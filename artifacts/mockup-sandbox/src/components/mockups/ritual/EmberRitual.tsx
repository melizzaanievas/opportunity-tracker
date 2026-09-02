import { useState, type CSSProperties } from "react";

type NavKey = "today" | "archive" | "profile";

function PlayIcon({ paused = false }: { paused?: boolean }) {
  return paused ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.7v12.6a1.1 1.1 0 0 0 1.68.94l9.2-6.3a1.14 1.14 0 0 0 0-1.88l-9.2-6.3A1.1 1.1 0 0 0 8 5.7Z" fill="currentColor" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="4" width="6" height="6" rx="1.2" fill="currentColor" />
      <rect x="14" y="4" width="6" height="6" rx="1.2" fill="currentColor" />
      <rect x="4" y="14" width="6" height="6" rx="1.2" fill="currentColor" />
      <rect x="14" y="14" width="6" height="6" rx="1.2" fill="currentColor" />
    </svg>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 12h3l2-5 4 10 2-7 2 2h5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="8" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.6 19c.6-3.1 2.7-4.8 6.4-4.8s5.8 1.7 6.4 4.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function EmberRitual() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeNav, setActiveNav] = useState<NavKey>("today");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const chooseNav = (nav: NavKey) => {
    setActiveNav(nav);
    if (nav !== "today") setIsPlaying(false);
  };

  return (
    <div className="ember-shell">
      <style>{`
        .ember-shell {
          --ink: #f5f0e8;
          --dim: rgba(245, 240, 232, .58);
          --faint: rgba(245, 240, 232, .2);
          --acid: #d4f34a;
          --coral: #ff795f;
          --violet: #a08cff;
          min-height: 100dvh;
          width: 100%;
          display: grid;
          place-items: center;
          overflow: hidden;
          background: #171118;
          color: var(--ink);
          font-family: "Trebuchet MS", "Arial Narrow", sans-serif;
        }
        .ember-app {
          position: relative;
          width: min(100%, 520px);
          height: 100dvh;
          min-height: 620px;
          max-height: 980px;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(ellipse at 74% 15%, rgba(255, 97, 46, .9) 0%, rgba(183, 43, 38, .5) 27%, transparent 51%),
            radial-gradient(ellipse at 16% 52%, rgba(104, 28, 41, .9) 0%, transparent 41%),
            radial-gradient(ellipse at 90% 74%, rgba(70, 23, 54, .75), transparent 44%),
            linear-gradient(157deg, #c54d1f 0%, #5d191f 33%, #21101b 64%, #0d0b13 100%);
        }
        .ember-app::before {
          content: "";
          position: absolute;
          inset: -18%;
          z-index: -1;
          opacity: .52;
          filter: blur(42px);
          background:
            radial-gradient(ellipse at 38% 25%, #ffb02e 0 9%, transparent 23%),
            radial-gradient(ellipse at 69% 47%, #b91b3b 0 10%, transparent 27%),
            radial-gradient(ellipse at 21% 74%, #3d143e 0 12%, transparent 32%);
          transform: rotate(-8deg) scale(1.08);
        }
        .ember-app::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: 20;
          pointer-events: none;
          opacity: .08;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.9'/%3E%3C/svg%3E");
          mix-blend-mode: screen;
        }
        .ember-top {
          position: relative;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 22px 25px 0;
          font-size: 10px;
          letter-spacing: .18em;
          font-weight: 700;
        }
        .ember-time {
          font-size: 15px;
          letter-spacing: -.03em;
          font-weight: 600;
        }
        .ember-code {
          color: var(--acid);
        }
        .ember-portal {
          width: 28px;
          height: 28px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(245,240,232,.72);
          border-radius: 50%;
          color: var(--ink);
          background: transparent;
          cursor: pointer;
          transition: transform .25s ease, background .25s ease;
        }
        .ember-portal:hover { transform: rotate(18deg); background: rgba(245,240,232,.14); }
        .ember-portal svg { width: 14px; height: 14px; }
        .ember-rail {
          position: absolute;
          z-index: 1;
          left: 20px;
          top: 168px;
          display: flex;
          gap: 18px;
          align-items: center;
          color: rgba(245,240,232,.62);
          font-size: 9px;
          letter-spacing: .16em;
          writing-mode: vertical-rl;
          transform: rotate(180deg);
        }
        .ember-rail i {
          display: block;
          width: 1px;
          height: 54px;
          background: linear-gradient(var(--acid), transparent);
        }
        .ember-ghost {
          position: absolute;
          z-index: -1;
          top: 98px;
          right: -48px;
          color: rgba(255, 217, 177, .11);
          font-size: clamp(100px, 30vw, 180px);
          line-height: .78;
          letter-spacing: -.13em;
          font-weight: 900;
          transform: rotate(90deg);
          transform-origin: center;
          user-select: none;
        }
        .ember-content {
          position: absolute;
          inset: 0;
          z-index: 1;
          padding: 17vh 25px 154px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        .ember-kicker {
          display: flex;
          align-items: center;
          gap: 9px;
          color: var(--acid);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: .22em;
          text-transform: uppercase;
        }
        .ember-kicker::before {
          content: "";
          display: inline-block;
          width: 21px;
          height: 2px;
          background: var(--acid);
        }
        .ember-heading {
          margin: 18px 0 0;
          max-width: 390px;
          font-family: Impact, "Arial Narrow", sans-serif;
          font-size: clamp(64px, 18vw, 98px);
          line-height: .78;
          font-weight: 900;
          letter-spacing: -.065em;
          text-transform: uppercase;
        }
        .ember-heading span {
          display: block;
        }
        .ember-heading .line-two {
          margin-left: 34px;
          color: transparent;
          -webkit-text-stroke: 1.5px rgba(245,240,232,.86);
        }
        .ember-heading .line-three {
          margin-left: 9px;
          color: var(--coral);
        }
        .ember-sub {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 18px;
          margin-top: 28px;
        }
        .ember-description {
          max-width: 200px;
          color: rgba(245,240,232,.68);
          font-size: 12px;
          line-height: 1.45;
          letter-spacing: .015em;
        }
        .ember-description strong {
          display: block;
          margin-bottom: 5px;
          color: var(--ink);
          font-size: 11px;
          letter-spacing: .11em;
          text-transform: uppercase;
        }
        .ember-play {
          position: relative;
          flex: 0 0 auto;
          width: 76px;
          height: 76px;
          display: grid;
          place-items: center;
          color: #171118;
          border: 0;
          border-radius: 50%;
          background: var(--acid);
          cursor: pointer;
          box-shadow: 0 0 0 1px rgba(212,243,74,.45), 0 0 0 8px rgba(212,243,74,.12);
          transition: transform .25s ease, background .25s ease;
        }
        .ember-play:hover { transform: scale(1.06) rotate(-4deg); }
        .ember-play:active { transform: scale(.97); }
        .ember-play svg { width: 25px; height: 25px; margin-left: 2px; }
        .ember-play.is-playing { background: var(--coral); }
        .ember-duration {
          position: absolute;
          right: 5px;
          bottom: -23px;
          color: var(--acid);
          font-family: "Courier New", monospace;
          font-size: 9px;
          letter-spacing: .07em;
        }
        .ember-wave {
          display: flex;
          align-items: center;
          gap: 4px;
          height: 30px;
          margin-top: 48px;
        }
        .ember-wave b {
          display: block;
          width: 2px;
          height: var(--h);
          background: var(--ink);
          opacity: .62;
          transform-origin: center;
          transition: transform .5s ease, opacity .5s ease;
        }
        .ember-wave.is-playing b { animation: ember-pulse 1.1s ease-in-out infinite alternate; }
        .ember-wave.is-playing b:nth-child(3n) { animation-delay: -.4s; }
        .ember-wave.is-playing b:nth-child(4n) { animation-delay: -.7s; }
        .ember-wave b:nth-child(1), .ember-wave b:nth-child(2), .ember-wave b:nth-child(3),
        .ember-wave b:nth-child(4), .ember-wave b:nth-child(5), .ember-wave b:nth-child(6) { background: var(--acid); opacity: 1; }
        @keyframes ember-pulse { to { transform: scaleY(.35); opacity: .35; } }
        .ember-bottom {
          position: absolute;
          z-index: 3;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 16px 25px 22px;
          background: linear-gradient(transparent, rgba(12, 8, 16, .94) 30%);
        }
        .ember-next {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 0 15px;
          border-bottom: 1px solid rgba(245,240,232,.16);
        }
        .ember-next-label {
          color: rgba(245,240,232,.5);
          font-size: 9px;
          letter-spacing: .18em;
          text-transform: uppercase;
        }
        .ember-next-title {
          margin-top: 4px;
          font-family: Georgia, serif;
          font-size: 20px;
          font-style: italic;
          letter-spacing: -.04em;
        }
        .ember-browse {
          padding: 8px 0;
          color: var(--acid);
          border: 0;
          border-bottom: 1px solid var(--acid);
          background: transparent;
          font-size: 9px;
          letter-spacing: .1em;
          text-transform: uppercase;
          cursor: pointer;
        }
        .ember-nav {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 4px;
          padding-top: 15px;
        }
        .ember-nav-button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 38px;
          color: rgba(245,240,232,.42);
          border: 0;
          background: transparent;
          font-size: 9px;
          letter-spacing: .13em;
          text-transform: uppercase;
          cursor: pointer;
          transition: color .2s ease, transform .2s ease;
        }
        .ember-nav-button:hover { color: var(--ink); transform: translateY(-2px); }
        .ember-nav-button.active { color: var(--acid); }
        .ember-nav-button svg { width: 16px; height: 16px; }
        .ember-sheet {
          position: absolute;
          z-index: 10;
          inset: auto 12px 12px;
          padding: 20px;
          color: #20131b;
          border-radius: 4px;
          background: #f4eddc;
          box-shadow: 0 18px 60px rgba(0,0,0,.42);
          animation: ember-rise .3s ease both;
        }
        @keyframes ember-rise { from { opacity: 0; transform: translateY(18px); } to { opacity: 1; transform: translateY(0); } }
        .ember-sheet-top { display: flex; align-items: center; justify-content: space-between; }
        .ember-sheet-kicker { color: #bc3a34; font-size: 9px; font-weight: 700; letter-spacing: .17em; text-transform: uppercase; }
        .ember-sheet-close { width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid rgba(32,19,27,.35); border-radius: 50%; color: #20131b; background: transparent; cursor: pointer; }
        .ember-sheet-close svg { width: 13px; height: 13px; }
        .ember-sheet h2 { margin: 13px 0 16px; font-family: Impact, sans-serif; font-size: 38px; line-height: .9; letter-spacing: -.04em; text-transform: uppercase; }
        .ember-calendar { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 10px; font-family: "Courier New", monospace; font-size: 10px; text-align: center; }
        .ember-calendar span { padding: 7px 0; }
        .ember-calendar .muted { opacity: .3; }
        .ember-calendar .marked { color: #f4eddc; border-radius: 50%; background: #bc3a34; }
        .ember-library-list { display: grid; gap: 8px; }
        .ember-library-item { display: flex; justify-content: space-between; padding: 11px 0; border-top: 1px solid rgba(32,19,27,.18); font-size: 12px; }
        .ember-library-item small { color: #bc3a34; font-family: "Courier New", monospace; }
        @media (max-width: 370px) {
          .ember-content { padding-left: 20px; padding-right: 20px; }
          .ember-top, .ember-bottom { padding-left: 20px; padding-right: 20px; }
          .ember-heading { font-size: 61px; }
        }
      `}</style>

      <main className="ember-app">
        <div className="ember-top">
          <span className="ember-time">09:41</span>
          <span className="ember-code">RITUAL / 03</span>
          <button className="ember-portal" type="button" aria-label="Open practice calendar" onClick={() => setCalendarOpen(true)}>
            <GridIcon />
          </button>
        </div>

        <div className="ember-rail" aria-hidden="true">
          <span>27° NORTH</span>
          <i />
          <span>SLOW / STAY</span>
        </div>
        <div className="ember-ghost" aria-hidden="true">UNWIND</div>

        <section className="ember-content">
          <div>
            <div className="ember-kicker">Daily meditation / 08.27</div>
            <h1 className="ember-heading">
              <span>Engage</span>
              <span className="line-two">&amp; the</span>
              <span className="line-three">quiet.</span>
            </h1>
            <div className="ember-sub">
              <p className="ember-description">
                <strong>{isPlaying ? "Now in session" : "A seven minute reset"}</strong>
                {isPlaying ? "Keep your eyes soft. Let the room become background." : "For the part of your day that does not need to be productive."}
              </p>
              <button className={`ember-play${isPlaying ? " is-playing" : ""}`} type="button" aria-label={isPlaying ? "Pause meditation" : "Play meditation"} onClick={() => setIsPlaying((playing) => !playing)}>
                <PlayIcon paused={isPlaying} />
                <span className="ember-duration">{isPlaying ? "02:14" : "07:00"}</span>
              </button>
            </div>
            <div className={`ember-wave${isPlaying ? " is-playing" : ""}`} aria-label="Meditation progress">
              {[18, 10, 26, 15, 22, 12, 9, 17, 25, 13, 20, 10, 17, 27, 12, 21, 15, 9, 19, 13, 24, 11, 18, 9, 14, 21, 10, 18, 13, 25, 9, 15, 22, 12, 20, 10, 16, 24].map((height, index) => (
                <b key={`${height}-${index}`} style={{ "--h": `${height}px` } as CSSProperties} />
              ))}
            </div>
          </div>

          <div />
        </section>

        <footer className="ember-bottom">
          <div className="ember-next">
            <div>
              <div className="ember-next-label">Next on the mat</div>
              <div className="ember-next-title">The room inside</div>
            </div>
            <button className="ember-browse" type="button" onClick={() => setLibraryOpen(true)}>Browse sessions</button>
          </div>
          <nav className="ember-nav" aria-label="Practice sections">
            <button className={`ember-nav-button${activeNav === "today" ? " active" : ""}`} type="button" onClick={() => chooseNav("today")}>
              <GridIcon /> Today
            </button>
            <button className={`ember-nav-button${activeNav === "archive" ? " active" : ""}`} type="button" onClick={() => chooseNav("archive")}>
              <WaveIcon /> Archive
            </button>
            <button className={`ember-nav-button${activeNav === "profile" ? " active" : ""}`} type="button" onClick={() => chooseNav("profile")}>
              <UserIcon /> Me
            </button>
          </nav>
        </footer>

        {calendarOpen && (
          <section className="ember-sheet" aria-label="Practice calendar">
            <div className="ember-sheet-top">
              <span className="ember-sheet-kicker">Your practice / august</span>
              <button className="ember-sheet-close" type="button" aria-label="Close calendar" onClick={() => setCalendarOpen(false)}><CloseIcon /></button>
            </div>
            <h2>Keep<br />showing up.</h2>
            <div className="ember-calendar" aria-label="August practice days">
              {["M", "T", "W", "T", "F", "S", "S", "—", "—", "—", "—", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31"].map((day, index) => (
                <span key={`${day}-${index}`} className={day === "27" ? "marked" : index < 12 || day === "—" ? "muted" : ""}>{day}</span>
              ))}
            </div>
          </section>
        )}

        {libraryOpen && (
          <section className="ember-sheet" aria-label="Meditation library">
            <div className="ember-sheet-top">
              <span className="ember-sheet-kicker">Open frequency / library</span>
              <button className="ember-sheet-close" type="button" aria-label="Close library" onClick={() => setLibraryOpen(false)}><CloseIcon /></button>
            </div>
            <h2>Find<br />your frequency.</h2>
            <div className="ember-library-list">
              <div className="ember-library-item"><span>01 / The room inside</span><small>07:00</small></div>
              <div className="ember-library-item"><span>02 / Soft focus</span><small>11:30</small></div>
              <div className="ember-library-item"><span>03 / A wider sky</span><small>18:20</small></div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default EmberRitual;