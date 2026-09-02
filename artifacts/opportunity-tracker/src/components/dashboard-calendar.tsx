import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import type { Opportunity } from "@workspace/api-client-react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListTodo,
  Plus,
} from "lucide-react";

type DashboardCalendarProps = {
  opportunities: Opportunity[];
  onOpenOpportunity: (opportunity: Opportunity) => void;
  onSetDeadline: (opportunityId: number, deadline: string) => void;
  isSavingDeadline: boolean;
};

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const EVENT_STYLES: Record<
  string,
  { label: string; className: string }
> = {
  "to-apply": {
    label: "To Apply",
    className: "calendar-event-amber",
  },
  applied: {
    label: "Applied / Pending Response",
    className: "calendar-event-blue",
  },
  interviewing: {
    label: "Interviewing",
    className: "calendar-event-emerald",
  },
  offered: {
    label: "Offered",
    className: "calendar-event-purple",
  },
  archived: {
    label: "Archived",
    className: "calendar-event-slate",
  },
};

function hasPendingTasks(opportunity: Opportunity) {
  return (
    (opportunity.taskCount ?? 0) > (opportunity.completedTaskCount ?? 0)
  );
}

export function DashboardCalendar({
  opportunities,
  onOpenOpportunity,
  onSetDeadline,
  isSavingDeadline,
}: DashboardCalendarProps) {
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [selectedUnscheduledId, setSelectedUnscheduledId] = useState<
    number | null
  >(null);
  const [deadlineDraft, setDeadlineDraft] = useState("");

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    return eachDayOfInterval({
      start: startOfWeek(monthStart, { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 }),
    });
  }, [calendarMonth]);

  const eventsByDay = useMemo(() => {
    const events = new Map<string, Opportunity[]>();

    opportunities
      .filter((opportunity) => opportunity.status !== "archived")
      .filter((opportunity) => opportunity.deadline)
      .forEach((opportunity) => {
        const key = opportunity.deadline as string;
        const existing = events.get(key) ?? [];
        events.set(key, [...existing, opportunity]);
      });

    return events;
  }, [opportunities]);

  const unscheduledOpportunities = opportunities.filter(
    (opportunity) => !opportunity.deadline,
  );

  const selectedUnscheduled = unscheduledOpportunities.find(
    (opportunity) => opportunity.id === selectedUnscheduledId,
  );

  const selectUnscheduled = (opportunity: Opportunity) => {
    setSelectedUnscheduledId(opportunity.id);
    setDeadlineDraft(opportunity.deadline ?? "");
  };

  const saveDeadline = () => {
    if (!selectedUnscheduled || !deadlineDraft) return;
    onSetDeadline(selectedUnscheduled.id, deadlineDraft);
  };

  return (
    <div className="dashboard-calendar-layout">
      <section className="dashboard-calendar-panel" aria-label="Monthly calendar">
        <div className="dashboard-calendar-toolbar">
          <div>
            <p className="dashboard-section-kicker">Deadline map</p>
            <h3 className="dashboard-calendar-month">
              {format(calendarMonth, "MMMM yyyy")}
            </h3>
          </div>
          <div className="dashboard-calendar-nav">
            <button
              type="button"
              className="dashboard-calendar-nav-button"
              onClick={() => setCalendarMonth((month) => subMonths(month, 1))}
              aria-label="Previous month"
              data-testid="button-calendar-previous-month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="dashboard-calendar-today-button"
              onClick={() => setCalendarMonth(new Date())}
              data-testid="button-calendar-today"
            >
              Today
            </button>
            <button
              type="button"
              className="dashboard-calendar-nav-button"
              onClick={() => setCalendarMonth((month) => addMonths(month, 1))}
              aria-label="Next month"
              data-testid="button-calendar-next-month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="dashboard-calendar-legend" aria-label="Calendar legend">
          {Object.entries(EVENT_STYLES)
            .filter(([status]) => status !== "archived")
            .map(([status, eventStyle]) => (
              <span className="dashboard-calendar-legend-item" key={status}>
                <span
                  className={`dashboard-calendar-legend-dot ${eventStyle.className}`}
                  aria-hidden="true"
                />
                {eventStyle.label}
              </span>
            ))}
          <span className="dashboard-calendar-legend-item">
            <span
              className="dashboard-calendar-legend-dot calendar-event-purple"
              aria-hidden="true"
            />
            Follow-up
          </span>
        </div>

        <div className="dashboard-calendar-grid" role="grid" aria-label={format(calendarMonth, "MMMM yyyy")}>
          {WEEKDAYS.map((weekday) => (
            <div
              className="dashboard-calendar-weekday"
              role="columnheader"
              key={weekday}
            >
              {weekday}
            </div>
          ))}

          {calendarDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const events = eventsByDay.get(dayKey) ?? [];
            const isCurrentMonth = isSameMonth(day, calendarMonth);
            const today = isToday(day);

            return (
              <div
                className={[
                  "dashboard-calendar-day",
                  isCurrentMonth ? "" : "is-outside-month",
                  today ? "is-today" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                role="gridcell"
                key={dayKey}
                data-testid={`calendar-day-${dayKey}`}
              >
                <div className="dashboard-calendar-day-number">
                  <span>{format(day, "d")}</span>
                  {today ? <span className="dashboard-calendar-today-label">Today</span> : null}
                </div>
                <div className="dashboard-calendar-events">
                  {events.map((opportunity) => {
                    const eventStyle =
                      EVENT_STYLES[opportunity.status] ?? EVENT_STYLES["to-apply"];
                    const pendingTasks = hasPendingTasks(opportunity);

                    return (
                      <button
                        type="button"
                        className={`dashboard-calendar-event ${eventStyle.className}`}
                        key={opportunity.id}
                        onClick={() => onOpenOpportunity(opportunity)}
                        title={`Open ${opportunity.title}`}
                        data-testid={`calendar-event-${opportunity.id}`}
                      >
                        <span className="dashboard-calendar-event-title">
                          {opportunity.title}
                        </span>
                        {pendingTasks ? (
                          <span className="calendar-event-followup-pill">
                            <ListTodo className="h-3 w-3" />
                            Follow-up
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <aside
        className="dashboard-calendar-unscheduled"
        aria-label="Unscheduled opportunities"
      >
        <div className="dashboard-calendar-unscheduled-heading">
          <div>
            <p className="dashboard-section-kicker">Needs a date</p>
            <h3 className="dashboard-calendar-side-title">
              Unscheduled Opportunities
            </h3>
          </div>
          <span className="dashboard-calendar-count">
            {unscheduledOpportunities.length}
          </span>
        </div>

        {unscheduledOpportunities.length === 0 ? (
          <div className="dashboard-calendar-unscheduled-empty">
            <CalendarDays className="h-7 w-7" />
            <p>Everything has a place on your deadline map.</p>
          </div>
        ) : (
          <div className="dashboard-calendar-unscheduled-list">
            {unscheduledOpportunities.map((opportunity) => {
              const selected = opportunity.id === selectedUnscheduledId;

              return (
                <div
                  className={`dashboard-calendar-unscheduled-item ${selected ? "is-selected" : ""}`}
                  key={opportunity.id}
                  data-testid={`unscheduled-opportunity-${opportunity.id}`}
                >
                  <button
                    type="button"
                    className="dashboard-calendar-unscheduled-select"
                    onClick={() => selectUnscheduled(opportunity)}
                    aria-pressed={selected}
                    data-testid={`button-select-unscheduled-${opportunity.id}`}
                  >
                    <span className="dashboard-calendar-unscheduled-title">
                      {opportunity.title}
                    </span>
                    <span className="dashboard-calendar-unscheduled-meta">
                      {opportunity.company || opportunity.type}
                    </span>
                  </button>

                  {selected ? (
                    <div className="dashboard-calendar-deadline-editor">
                      <label
                        className="dashboard-calendar-deadline-label"
                        htmlFor={`deadline-${opportunity.id}`}
                      >
                        Set deadline
                      </label>
                      <div className="dashboard-calendar-deadline-row">
                        <input
                          id={`deadline-${opportunity.id}`}
                          type="date"
                          value={deadlineDraft}
                          onChange={(event) => setDeadlineDraft(event.target.value)}
                          className="dashboard-calendar-date-input"
                          data-testid={`input-deadline-${opportunity.id}`}
                        />
                        <button
                          type="button"
                          className="dashboard-calendar-save-button"
                          onClick={saveDeadline}
                          disabled={!deadlineDraft || isSavingDeadline}
                          aria-label={`Save deadline for ${opportunity.title}`}
                          data-testid={`button-save-deadline-${opportunity.id}`}
                        >
                          {isSavingDeadline ? (
                            <span className="dashboard-calendar-save-spinner" aria-hidden="true" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}