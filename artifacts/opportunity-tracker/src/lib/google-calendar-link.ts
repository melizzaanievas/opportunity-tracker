interface GoogleCalendarLinkData {
  title: string;
  deadline?: string | null;
  summary?: string | null;
  url?: string | null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatGoogleCalendarDate(date: Date): string {
  return [
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}`,
    `T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`,
  ].join("");
}

function getEventDates(deadline: string | null | undefined, now: Date): [Date, Date] {
  if (deadline) {
    const deadlineDate = new Date(`${deadline}T09:00:00.000Z`);
    if (!Number.isNaN(deadlineDate.getTime())) {
      return [deadlineDate, new Date(deadlineDate.getTime() + 60 * 60 * 1000)];
    }
  }

  const start = new Date(now);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return [start, end];
}

export function buildGoogleCalendarUrl(
  data: GoogleCalendarLinkData,
  now: Date = new Date(),
): string {
  const [start, end] = getEventDates(data.deadline, now);
  const details = [data.summary, data.url ? `Link: ${data.url}` : null]
    .filter(Boolean)
    .join("\n\n");

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(data.title)}&dates=${formatGoogleCalendarDate(start)}/${formatGoogleCalendarDate(end)}&details=${encodeURIComponent(details)}`;
}