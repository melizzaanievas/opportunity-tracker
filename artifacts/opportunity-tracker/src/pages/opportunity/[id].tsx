import { useState, useRef, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { format } from "date-fns";
import { 
  useGetOpportunity, 
  useUpdateOpportunity, 
  useDeleteOpportunity,
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  getGetOpportunityQueryKey,
  getListTasksQueryKey,
  OpportunityPatch,
  OpportunityPatchStatus,
  OpportunityPatchType
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { buildGoogleCalendarUrl } from "@/lib/google-calendar-link";
import { 
  ArrowLeft, 
  Calendar as CalendarIcon, 
  ExternalLink, 
  Trash2, 
  Edit3, 
  Plus, 
  Loader2,
  CheckCircle2,
  AlignLeft,
  ListTodo
} from "lucide-react";

export default function OpportunityDetail() {
  const { id } = useParams();
  const numId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: opp, isLoading: oppLoading } = useGetOpportunity(numId, {
    query: { enabled: !!numId, queryKey: getGetOpportunityQueryKey(numId) }
  });
  
  const { data: tasks, isLoading: tasksLoading } = useListTasks(numId, {
    query: { enabled: !!numId, queryKey: getListTasksQueryKey(numId) }
  });

  const updateOpp = useUpdateOpportunity();
  const deleteOpp = useDeleteOpportunity();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState<OpportunityPatch>({});

  // Sync edit form when opening modal
  useEffect(() => {
    if (opp && isEditModalOpen) {
      setEditForm({
        title: opp.title,
        url: opp.url,
        type: opp.type as OpportunityPatchType,
        status: opp.status as OpportunityPatchStatus,
        deadline: opp.deadline || undefined,
        summary: opp.summary || "",
        keyActionSteps: opp.keyActionSteps || "",
      });
    }
  }, [opp, isEditModalOpen]);

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateOpp.mutate(
      { id: numId, data: editForm },
      {
        onSuccess: (data) => {
          queryClient.setQueryData(getGetOpportunityQueryKey(numId), data);
          setIsEditModalOpen(false);
          toast({ title: "Updated successfully" });
        }
      }
    );
  };

  const handleDeleteOpp = () => {
    if (confirm("Are you sure you want to delete this opportunity?")) {
      deleteOpp.mutate(
        { id: numId },
        {
          onSuccess: () => {
            toast({ title: "Deleted" });
            setLocation("/dashboard");
          }
        }
      );
    }
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    createTask.mutate(
      { id: numId, data: { title: newTaskTitle } },
      {
        onSuccess: () => {
          setNewTaskTitle("");
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(numId) });
          queryClient.invalidateQueries({ queryKey: getGetOpportunityQueryKey(numId) });
        }
      }
    );
  };

  const handleToggleTask = (taskId: number, currentStatus: boolean) => {
    updateTask.mutate(
      { id: numId, taskId, data: { completed: !currentStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(numId) });
          queryClient.invalidateQueries({ queryKey: getGetOpportunityQueryKey(numId) });
        }
      }
    );
  };

  const handleDeleteTask = (taskId: number) => {
    deleteTask.mutate(
      { id: numId, taskId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey(numId) });
          queryClient.invalidateQueries({ queryKey: getGetOpportunityQueryKey(numId) });
        }
      }
    );
  };

  const handleCalendar = () => {
    if (!opp) return;

    window.open(
      buildGoogleCalendarUrl({
        title: opp.title,
        deadline: opp.deadline,
        summary: opp.summary,
        url: opp.url,
      }),
      "_blank",
      "noopener,noreferrer",
    );
  };

  const sans = "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif";
  const serif = "'Cormorant Garamond', Georgia, serif";

  const glassCard: React.CSSProperties = {
    background: "rgba(255,255,255,0.08)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(230,220,255,0.22)",
    borderRadius: "16px",
    boxShadow: "0 8px 32px rgba(12,10,28,0.3)",
  };

  if (oppLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#F3E5AB" }} />
        </div>
      </AppLayout>
    );
  }

  if (!opp) {
    return (
      <AppLayout>
        <div className="text-center py-24" style={{ fontFamily: sans, color: "#E2DAF0" }}>Opportunity not found.</div>
      </AppLayout>
    );
  }

  const completedCount = tasks?.filter(t => t.completed).length || 0;
  const totalCount = tasks?.length || 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  /* ── pill tag helper ── */
  const PillTag = ({ children, color = "rgba(230,220,255,0.18)", textColor = "#E2DAF0", borderColor = "rgba(230,220,255,0.28)" }: {
    children: React.ReactNode; color?: string; textColor?: string; borderColor?: string;
  }) => (
    <span style={{
      fontFamily: sans, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.08em",
      textTransform: "uppercase", padding: "3px 10px", borderRadius: "999px",
      background: color, color: textColor, border: `1px solid ${borderColor}`,
    }}>
      {children}
    </span>
  );

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        {/* Top nav row */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard">
            <button
              className="flex items-center gap-1.5 transition-all duration-200"
              style={{
                fontFamily: sans, fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.04em",
                padding: "6px 14px", borderRadius: "999px",
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(230,220,255,0.18)",
                color: "#a8a0be", cursor: "pointer",
              }}
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
          </Link>
          <div className="flex gap-2">
            <button
              onClick={() => setIsEditModalOpen(true)}
              className="flex items-center gap-1.5 transition-all duration-200"
              style={{
                fontFamily: sans, fontSize: "0.78rem", fontWeight: 600, letterSpacing: "0.04em",
                padding: "6px 14px", borderRadius: "999px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(230,220,255,0.25)",
                color: "#E2DAF0", cursor: "pointer",
              }}
            >
              <Edit3 className="w-3.5 h-3.5" /> Edit
            </button>
            <button
              onClick={handleDeleteOpp}
              className="delete-opportunity-button flex items-center justify-center gap-1.5 transition-all duration-200"
              aria-label="Delete opportunity"
              title="Delete opportunity"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        <div className="space-y-8">
          {/* ── Main Info Header ── */}
          <div>
            {/* Type / Status / Deadline tags */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              {/* Type tag — gold-tinted glass */}
              <PillTag color="rgba(243,229,171,0.12)" textColor="#F3E5AB" borderColor="rgba(243,229,171,0.35)">
                {opp.type}
              </PillTag>
              {/* Status tag */}
              <PillTag color="rgba(255,255,255,0.06)" textColor="#c4b5fd" borderColor="rgba(196,181,253,0.3)">
                {opp.status.replace('-', ' ')}
              </PillTag>
              {/* Deadline tag */}
              {opp.deadline && (
                <span className="flex items-center gap-1.5" style={{
                  fontFamily: sans, fontSize: "0.7rem", fontWeight: 700, letterSpacing: "0.06em",
                  padding: "3px 10px", borderRadius: "999px",
                  background: "rgba(251,191,36,0.12)", color: "#fcd34d",
                  border: "1px solid rgba(251,191,36,0.3)",
                }}>
                  <CalendarIcon className="w-3 h-3" />
                  {format(new Date(opp.deadline), 'MMM d, yyyy')}
                </span>
              )}
            </div>

            {/* Title — serif */}
            <h1 style={{
              fontFamily: serif, fontSize: "2.4rem", fontWeight: 700,
              letterSpacing: "0.03em", color: "#F8F5FF",
              textShadow: "0 0 24px rgba(220,200,255,0.25)",
              marginBottom: "16px", lineHeight: 1.2,
            }}>
              {opp.title}
            </h1>

            {/* Action links */}
            <div className="flex items-center gap-3 flex-wrap">
              {opp.url && (
                <a
                  href={opp.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 transition-all duration-200"
                  style={{
                    fontFamily: sans, fontSize: "0.75rem", fontWeight: 700,
                    letterSpacing: "0.05em", padding: "7px 16px", borderRadius: "999px",
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(230,220,255,0.25)",
                    color: "#E2DAF0", textDecoration: "none",
                  }}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  VIEW POSTING
                </a>
              )}
              <button
                  onClick={handleCalendar}
                  aria-label="Add opportunity to Google Calendar"
                  className="flex items-center gap-1.5 transition-all duration-200"
                  style={{
                    fontFamily: sans, fontSize: "0.75rem", fontWeight: 700,
                    letterSpacing: "0.05em", padding: "7px 16px", borderRadius: "999px",
                    background: "rgba(255,255,255,0.06)", border: "1px solid rgba(230,220,255,0.25)",
                    color: "#E2DAF0", cursor: "pointer",
                  }}
                >
                  <CalendarIcon className="w-3.5 h-3.5" />
                  ADD TO CALENDAR
              </button>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">

              {/* ── Summary card ── */}
              {opp.summary && (
                <div style={glassCard}>
                  <div className="flex items-center gap-2 p-5 pb-3">
                    <AlignLeft className="w-4 h-4 shrink-0" style={{ color: "#a8a0be" }} />
                    <span style={{ fontFamily: sans, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", color: "#F3E5AB", textTransform: "uppercase" }}>
                      Summary
                    </span>
                  </div>
                  <div className="px-5 pb-5">
                    <p style={{ fontFamily: sans, fontSize: "0.875rem", color: "#E2DAF0", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                      {opp.summary}
                    </p>
                  </div>
                </div>
              )}

              {/* ── Action Plan card ── */}
              <div style={glassCard}>
                <div className="p-5 pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ListTodo className="w-4 h-4 shrink-0" style={{ color: "#a8a0be" }} />
                      <span style={{ fontFamily: sans, fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", color: "#F3E5AB", textTransform: "uppercase" }}>
                        Action Plan
                      </span>
                    </div>
                    <span style={{ fontFamily: sans, fontSize: "0.75rem", fontWeight: 600, color: "#a8a0be" }}>
                      {completedCount} / {totalCount} done
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div style={{ height: "4px", borderRadius: "999px", background: "rgba(255,255,255,0.1)", overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: "999px",
                      width: `${progressPercent}%`,
                      background: "linear-gradient(90deg, #818cf8, #c084fc)",
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                </div>
                <div className="px-5 pb-5 space-y-3">
                  {/* Task list */}
                  {tasksLoading ? (
                    <div className="flex flex-col gap-3">
                      {[1,2].map(i => (
                        <div key={i} className="h-10 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.05)" }} />
                      ))}
                    </div>
                  ) : tasks?.length === 0 ? (
                    <div className="text-center py-6" style={{
                      fontFamily: sans, fontSize: "0.8rem", fontStyle: "italic",
                      color: "#a8a0be", border: "1px dashed rgba(230,220,255,0.2)", borderRadius: "10px",
                    }}>
                      No tasks yet. Break down your next steps.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks?.map(task => (
                        <div
                          key={task.id}
                          className="flex items-start gap-3 p-3 rounded-xl transition-colors"
                          style={{
                            background: task.completed ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.06)",
                            border: task.completed ? "1px solid rgba(230,220,255,0.08)" : "1px solid rgba(230,220,255,0.18)",
                          }}
                        >
                          <Checkbox
                            checked={task.completed}
                            onCheckedChange={() => handleToggleTask(task.id, task.completed)}
                            className="mt-0.5"
                          />
                          <span
                            className="flex-1 text-sm leading-relaxed"
                            style={{
                              fontFamily: sans,
                              color: task.completed ? "#a8a0be" : "#E2DAF0",
                              textDecoration: task.completed ? "line-through" : "none",
                            }}
                          >
                            {task.title}
                          </span>
                          <button
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={deleteTask.isPending}
                            className="shrink-0 flex items-center justify-center transition-colors"
                            style={{
                              width: "26px", height: "26px", borderRadius: "6px",
                              background: "transparent", border: "none",
                              color: "#a8a0be", cursor: "pointer",
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fca5a5"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#a8a0be"; }}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Task form */}
                  <form onSubmit={handleCreateTask} className="flex items-center gap-2 pt-1">
                    <input
                      placeholder="Add a new task…"
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="flex-1 text-sm rounded-xl px-3 py-2 transition-all duration-200"
                      style={{
                        fontFamily: sans,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(230,220,255,0.2)",
                        color: "#F8F5FF",
                        outline: "none",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!newTaskTitle.trim() || createTask.isPending}
                      className="add-task-button flex items-center justify-center gap-1.5 shrink-0 transition-all duration-200"
                      style={{
                        minWidth: "72px", height: "36px", borderRadius: "999px",
                        background: "rgba(243,229,171,0.15)",
                        border: "1px solid rgba(243,229,171,0.4)",
                        color: "#F3E5AB", cursor: "pointer",
                      }}
                    >
                      {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      <span>Add</span>
                    </button>
                  </form>
                </div>
              </div>
            </div>

            {/* ── Sidebar: Extracted Tips ── */}
            <div className="space-y-6">
              {opp.keyActionSteps && (
                <div style={glassCard}>
                  <div className="flex items-center gap-2 p-5 pb-3">
                    <span style={{
                      fontFamily: sans, fontSize: "0.7rem", fontWeight: 700,
                      letterSpacing: "0.1em", color: "#F3E5AB", textTransform: "uppercase",
                    }}>
                      Extracted Tips
                    </span>
                  </div>
                  <div className="px-5 pb-5">
                    <p style={{
                      fontFamily: sans, fontSize: "0.82rem", color: "#E2DAF0",
                      lineHeight: 1.75, whiteSpace: "pre-wrap",
                    }}>
                      {opp.keyActionSteps}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="ethereal-dialog sm:max-w-[500px]">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="ethereal-dialog-title font-serif text-2xl">Edit Opportunity</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="ethereal-dialog-label">Title</label>
                <Input className="ethereal-dialog-field" value={editForm.title || ""} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="ethereal-dialog-label">Type</label>
                  <Select value={editForm.type} onValueChange={(v: OpportunityPatchType) => setEditForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger className="ethereal-dialog-field"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="job">Job</SelectItem>
                      <SelectItem value="grant">Grant</SelectItem>
                      <SelectItem value="hackathon">Hackathon</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="ethereal-dialog-label">Status</label>
                  <Select value={editForm.status} onValueChange={(v: OpportunityPatchStatus) => setEditForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="ethereal-dialog-field"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to-apply">To Apply</SelectItem>
                      <SelectItem value="applied">Applied</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="ethereal-dialog-label">Deadline</label>
                <Input className="ethereal-dialog-field" type="date" value={editForm.deadline || ""} onChange={e => setEditForm(p => ({ ...p, deadline: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="ethereal-dialog-label">URL</label>
                <Input className="ethereal-dialog-field" value={editForm.url || ""} onChange={e => setEditForm(p => ({ ...p, url: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="ethereal-dialog-label">Summary</label>
                <Textarea value={editForm.summary || ""} onChange={e => setEditForm(p => ({ ...p, summary: e.target.value }))} className="ethereal-dialog-field min-h-[100px]" />
              </div>
            </div>
            <DialogFooter className="ethereal-dialog-footer">
              <DialogClose asChild>
                <Button type="button" variant="ghost" className="ethereal-dialog-button">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={updateOpp.isPending} className="ethereal-dialog-button">
                {updateOpp.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
