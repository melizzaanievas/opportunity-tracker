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
  useAddToCalendar,
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
  const addToCalendar = useAddToCalendar();

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
    addToCalendar.mutate(
      { id: numId },
      {
        onSuccess: (res) => {
          if (res.authUrl) {
            window.open(res.authUrl, '_blank');
            toast({
              title: "Authorization required",
              description: "Please authorize Google Calendar in the new tab, then click the button again.",
            });
          } else if (res.success) {
            toast({
              title: "Added to Calendar",
              description: res.message || "Event created successfully.",
            });
          }
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to add to calendar.",
            variant: "destructive"
          });
        }
      }
    );
  };

  if (oppLoading) {
    return (
      <AppLayout>
        <div className="flex justify-center py-24"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      </AppLayout>
    );
  }

  if (!opp) {
    return (
      <AppLayout>
        <div className="text-center py-24">Opportunity not found.</div>
      </AppLayout>
    );
  }

  const completedCount = tasks?.filter(t => t.completed).length || 0;
  const totalCount = tasks?.length || 0;
  const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6 pb-12">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" asChild className="-ml-3 text-muted-foreground hover:text-foreground">
            <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Link>
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsEditModalOpen(true)} className="bg-card">
              <Edit3 className="w-4 h-4 mr-2" /> Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeleteOpp} className="bg-card text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="space-y-8">
          {/* Main Info Header */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Badge className="bg-primary/10 text-primary hover:bg-primary/20 capitalize font-medium">{opp.type}</Badge>
              <Badge variant="outline" className="capitalize bg-card">{opp.status.replace('-', ' ')}</Badge>
              {opp.deadline && (
                <Badge variant="secondary" className="flex items-center gap-1.5 bg-amber-50 text-amber-800 border-amber-200">
                  <CalendarIcon className="w-3 h-3" />
                  {format(new Date(opp.deadline), 'MMM d, yyyy')}
                </Badge>
              )}
            </div>
            
            <h1 className="text-4xl font-serif font-bold tracking-tight mb-4">{opp.title}</h1>
            
            <div className="flex items-center gap-4 flex-wrap">
              {opp.url && (
                <a href={opp.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline bg-blue-50 px-3 py-1.5 rounded-full font-medium transition-colors">
                  <ExternalLink className="w-4 h-4" />
                  View Original Posting
                </a>
              )}
              {opp.deadline && (
                <Button variant="outline" size="sm" onClick={handleCalendar} disabled={addToCalendar.isPending} className="rounded-full bg-card shadow-sm h-8">
                  {addToCalendar.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CalendarIcon className="w-3.5 h-3.5 mr-1.5" />}
                  Add to Calendar
                </Button>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div className="md:col-span-2 space-y-6">
              {/* Summary */}
              {opp.summary && (
                <Card className="shadow-sm bg-card/80 backdrop-blur-sm border-border/60">
                  <CardHeader className="pb-3 flex flex-row items-center gap-2">
                    <AlignLeft className="w-5 h-5 text-muted-foreground" />
                    <CardTitle className="text-lg">Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{opp.summary}</p>
                  </CardContent>
                </Card>
              )}

              {/* Tasks Area */}
              <Card className="shadow-sm bg-card/80 backdrop-blur-sm border-border/60">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ListTodo className="w-5 h-5 text-muted-foreground" />
                      <CardTitle className="text-lg">Action Plan</CardTitle>
                    </div>
                    <div className="text-sm font-medium text-muted-foreground">
                      {completedCount} / {totalCount} completed
                    </div>
                  </div>
                  <Progress value={progressPercent} className="h-2 bg-muted" />
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Task List */}
                  {tasksLoading ? (
                    <div className="animate-pulse flex flex-col gap-3">
                      {[1,2].map(i => <div key={i} className="h-10 bg-muted/50 rounded-md" />)}
                    </div>
                  ) : tasks?.length === 0 ? (
                    <div className="text-center py-6 text-sm text-muted-foreground italic border border-dashed rounded-md bg-muted/20">
                      No tasks yet. Break down your next steps.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {tasks?.map(task => (
                        <div 
                          key={task.id} 
                          className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                            task.completed ? 'bg-muted/30 border-transparent' : 'bg-card border-border/50 hover:border-border shadow-sm'
                          }`}
                        >
                          <Checkbox 
                            checked={task.completed} 
                            onCheckedChange={() => handleToggleTask(task.id, task.completed)}
                            className="mt-1"
                          />
                          <span className={`flex-1 text-sm leading-relaxed ${task.completed ? 'text-muted-foreground line-through' : 'text-foreground font-medium'}`}>
                            {task.title}
                          </span>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0 -mr-1 -mt-1"
                            onClick={() => handleDeleteTask(task.id)}
                            disabled={deleteTask.isPending}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Task */}
                  <form onSubmit={handleCreateTask} className="flex items-center gap-2 pt-2">
                    <Input 
                      placeholder="Add a new task..." 
                      value={newTaskTitle}
                      onChange={(e) => setNewTaskTitle(e.target.value)}
                      className="flex-1 bg-white/50"
                    />
                    <Button type="submit" size="icon" disabled={!newTaskTitle.trim() || createTask.isPending} className="shrink-0 rounded-full shadow-sm">
                      {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar info */}
            <div className="space-y-6">
              {opp.keyActionSteps && (
                <Card className="shadow-sm bg-primary/5 border-primary/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base text-primary">Extracted Tips</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-primary/80 whitespace-pre-wrap leading-relaxed">
                      {opp.keyActionSteps}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleEditSubmit}>
            <DialogHeader>
              <DialogTitle className="font-serif text-2xl">Edit Opportunity</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input value={editForm.title || ""} onChange={e => setEditForm(p => ({ ...p, title: e.target.value }))} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type</label>
                  <Select value={editForm.type} onValueChange={(v: OpportunityPatchType) => setEditForm(p => ({ ...p, type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="job">Job</SelectItem>
                      <SelectItem value="grant">Grant</SelectItem>
                      <SelectItem value="hackathon">Hackathon</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={editForm.status} onValueChange={(v: OpportunityPatchStatus) => setEditForm(p => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="to-apply">To Apply</SelectItem>
                      <SelectItem value="applied">Applied</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Deadline</label>
                <Input type="date" value={editForm.deadline || ""} onChange={e => setEditForm(p => ({ ...p, deadline: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">URL</label>
                <Input value={editForm.url || ""} onChange={e => setEditForm(p => ({ ...p, url: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Summary</label>
                <Textarea value={editForm.summary || ""} onChange={e => setEditForm(p => ({ ...p, summary: e.target.value }))} className="min-h-[100px]" />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="ghost">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={updateOpp.isPending}>
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