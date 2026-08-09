import { useState, useMemo } from "react";
import { Link } from "wouter";
import { format, differenceInDays, isPast } from "date-fns";
import { 
  useListOpportunities, 
  useGetDashboardStats, 
  useTestTelegramAlert,
  ListOpportunitiesStatus
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Briefcase, 
  Banknote, 
  Code, 
  FileQuestion,
  Clock,
  CheckCircle2,
  CalendarDays,
  Send,
  Loader2,
  AlertCircle
} from "lucide-react";

const TYPE_ICONS = {
  job: Briefcase,
  grant: Banknote,
  hackathon: Code,
  other: FileQuestion,
};

const STATUS_CONFIG = {
  "to-apply": { label: "To Apply", color: "bg-blue-100 text-blue-800 border-blue-200" },
  applied: { label: "Applied", color: "bg-purple-100 text-purple-800 border-purple-200" },
  completed: { label: "Completed", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
};

export default function Dashboard() {
  const [statusFilter, setStatusFilter] = useState<ListOpportunitiesStatus | "all">("all");
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: opportunities, isLoading: opsLoading } = useListOpportunities(
    statusFilter === "all" ? undefined : { status: statusFilter }
  );
  
  const testTelegram = useTestTelegramAlert();

  const handleTestAlert = () => {
    testTelegram.mutate(undefined, {
      onSuccess: (data) => {
        toast({
          title: "Telegram Alert Sent",
          description: data.message || "Test message sent successfully.",
        });
      },
      onError: () => {
        toast({
          title: "Failed to send",
          description: "Please check your Telegram configuration.",
          variant: "destructive"
        });
      }
    });
  };

  const renderDeadlineBadge = (deadline: string | null | undefined) => {
    if (!deadline) return null;
    const date = new Date(deadline);
    const days = differenceInDays(date, new Date());
    
    if (isPast(date) && days < 0) {
      return <Badge variant="destructive" className="ml-auto text-xs whitespace-nowrap">Past due</Badge>;
    }
    
    if (days <= 3) {
      return <Badge variant="destructive" className="ml-auto text-xs whitespace-nowrap">{days} {days === 1 ? 'day' : 'days'} left</Badge>;
    }
    
    if (days <= 7) {
      return <Badge variant="secondary" className="ml-auto text-xs whitespace-nowrap text-amber-700 bg-amber-100">{days} days left</Badge>;
    }

    return <Badge variant="outline" className="ml-auto text-xs whitespace-nowrap text-muted-foreground">{days} days left</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-8 pb-12">
        {/* Header Area */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-serif font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">Your command center for opportunities.</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleTestAlert}
            disabled={testTelegram.isPending}
            className="gap-2 shrink-0 self-start sm:self-auto bg-card hover:bg-card/50 shadow-sm rounded-full"
          >
            {testTelegram.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 text-blue-500" />}
            Test Alert
          </Button>
        </div>

        {/* Stats Row */}
        {statsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => (
              <Card key={i} className="h-24 animate-pulse bg-card/50" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-sm bg-primary text-primary-foreground border-transparent">
              <CardContent className="p-5 flex flex-col justify-center h-full">
                <p className="text-sm font-medium text-primary-foreground/80 mb-1">Total</p>
                <div className="text-3xl font-bold font-serif">{stats.total}</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-amber-200 bg-amber-50">
              <CardContent className="p-5 flex flex-col justify-center h-full relative overflow-hidden">
                <AlertCircle className="absolute right-[-10%] top-[-10%] w-16 h-16 text-amber-500/10" />
                <p className="text-sm font-medium text-amber-800 mb-1">Closing Soon (7d)</p>
                <div className="text-3xl font-bold font-serif text-amber-900">{stats.closingSoon}</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-blue-200 bg-blue-50">
              <CardContent className="p-5 flex flex-col justify-center h-full">
                <p className="text-sm font-medium text-blue-800 mb-1">To Apply</p>
                <div className="text-3xl font-bold font-serif text-blue-900">{stats.byStatus["to-apply"]}</div>
              </CardContent>
            </Card>
            <Card className="shadow-sm border-emerald-200 bg-emerald-50">
              <CardContent className="p-5 flex flex-col justify-center h-full">
                <p className="text-sm font-medium text-emerald-800 mb-1">Completed</p>
                <div className="text-3xl font-bold font-serif text-emerald-900">{stats.byStatus.completed}</div>
              </CardContent>
            </Card>
          </div>
        ) : null}

        {/* Main Content */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Tabs 
              value={statusFilter} 
              onValueChange={(v) => setStatusFilter(v as ListOpportunitiesStatus | "all")}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-4 w-full sm:w-[400px] h-11 bg-muted/50 p-1">
                <TabsTrigger value="all" className="rounded-md data-[state=active]:shadow-sm">All</TabsTrigger>
                <TabsTrigger value="to-apply" className="rounded-md data-[state=active]:shadow-sm">To Apply</TabsTrigger>
                <TabsTrigger value="applied" className="rounded-md data-[state=active]:shadow-sm">Applied</TabsTrigger>
                <TabsTrigger value="completed" className="rounded-md data-[state=active]:shadow-sm">Done</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {opsLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3].map(i => (
                <Card key={i} className="h-48 animate-pulse bg-card/50" />
              ))}
            </div>
          ) : opportunities?.length === 0 ? (
            <div className="text-center py-24 bg-card/30 rounded-2xl border border-dashed border-border/50">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Briefcase className="w-8 h-8 text-muted-foreground/50" />
              </div>
              <h3 className="text-lg font-medium text-foreground mb-2">No opportunities found</h3>
              <p className="text-muted-foreground max-w-sm mx-auto mb-6">
                You haven't tracked anything in this category yet. Time to add something new.
              </p>
              <Button className="rounded-full shadow-sm" asChild>
                <Link href="/add">Add Opportunity</Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {opportunities?.map((opp) => {
                const Icon = TYPE_ICONS[opp.type] || TYPE_ICONS.other;
                const statusConf = STATUS_CONFIG[opp.status];
                
                return (
                  <Link key={opp.id} href={`/opportunity/${opp.id}`}>
                    <Card className="group h-full flex flex-col hover:border-primary/40 hover:shadow-md transition-all duration-200 cursor-pointer overflow-hidden border-border/60 bg-card/80 backdrop-blur-sm">
                      <CardHeader className="p-5 pb-3">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className={`p-2 rounded-xl shrink-0 ${statusConf.color} bg-opacity-20`}>
                            <Icon className="w-5 h-5 opacity-80" />
                          </div>
                          {renderDeadlineBadge(opp.deadline)}
                        </div>
                        <CardTitle className="text-lg leading-tight line-clamp-2 group-hover:text-primary transition-colors">
                          {opp.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 pt-0 flex-1 flex flex-col justify-end space-y-4">
                        <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
                          <div className="flex items-center gap-1.5 font-medium">
                            <span className={`w-2 h-2 rounded-full ${opp.status === 'completed' ? 'bg-emerald-500' : opp.status === 'applied' ? 'bg-purple-500' : 'bg-blue-500'}`} />
                            {statusConf.label}
                          </div>
                          {opp.taskCount !== undefined && opp.taskCount > 0 && (
                            <div className="flex items-center gap-1.5 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {opp.completedTaskCount || 0}/{opp.taskCount}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}