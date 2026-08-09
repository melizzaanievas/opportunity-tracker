import { useState } from "react";
import { useLocation, Link } from "wouter";
import { 
  useCreateOpportunity, 
  useScrapeOpportunityUrl,
  OpportunityInput,
  OpportunityInputStatus,
  OpportunityInputType
} from "@workspace/api-client-react";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Wand2, ArrowLeft, Plus } from "lucide-react";

export default function AddOpportunity() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const scrapeUrl = useScrapeOpportunityUrl();
  const createOpp = useCreateOpportunity();

  const [scrapeInputUrl, setScrapeInputUrl] = useState("");
  const [isManual, setIsManual] = useState(false);
  
  const [formData, setFormData] = useState<OpportunityInput>({
    url: "",
    title: "",
    type: "job",
    status: "to-apply",
    deadline: "",
    summary: "",
    keyActionSteps: ""
  });

  const handleScrape = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scrapeInputUrl) return;
    
    scrapeUrl.mutate(
      { data: { url: scrapeInputUrl } },
      {
        onSuccess: (data) => {
          setFormData(prev => ({
            ...prev,
            url: data.url,
            title: data.title || "",
            deadline: data.deadline || "",
            summary: data.summary || "",
            keyActionSteps: data.keyActionSteps || ""
          }));
          setIsManual(true); // show form
          if (data.scrapeSuccess) {
            toast({ title: "Auto-filled from URL" });
          } else {
            toast({ title: "Could not scrape fully", description: "Please fill remaining details manually." });
          }
        },
        onError: () => {
          toast({ 
            title: "Scrape failed", 
            description: "Showing manual form.", 
            variant: "destructive" 
          });
          setFormData(p => ({ ...p, url: scrapeInputUrl }));
          setIsManual(true);
        }
      }
    );
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createOpp.mutate(
      { data: formData },
      {
        onSuccess: (data) => {
          toast({ title: "Opportunity created" });
          setLocation(`/opportunity/${data.id}`);
        },
        onError: (err) => {
          toast({
            title: "Failed to create",
            description: err.error || "Please check your inputs.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6 pb-12">
        <Button variant="ghost" size="sm" asChild className="-ml-3 text-muted-foreground hover:text-foreground">
          <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Link>
        </Button>

        <div className="mb-8">
          <h1 className="text-4xl font-serif font-bold tracking-tight mb-2">New Opportunity</h1>
          <p className="text-muted-foreground">Add a job, grant, or hackathon you want to track.</p>
        </div>

        {!isManual ? (
          <Card className="shadow-sm border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-primary">
                <Wand2 className="w-5 h-5" />
                Magic Import
              </CardTitle>
              <CardDescription className="text-primary/70">
                Paste the URL. We'll automatically extract the title, deadline, and summary.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleScrape} className="flex gap-2">
                <Input 
                  type="url" 
                  placeholder="https://..." 
                  value={scrapeInputUrl}
                  onChange={(e) => setScrapeInputUrl(e.target.value)}
                  className="flex-1 bg-background"
                  required
                />
                <Button type="submit" disabled={scrapeUrl.isPending || !scrapeInputUrl}>
                  {scrapeUrl.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Import
                </Button>
              </form>
            </CardContent>
            <CardFooter className="pt-0">
              <Button variant="link" size="sm" onClick={() => setIsManual(true)} className="text-primary/60 px-0 hover:text-primary">
                Skip and enter manually
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="shadow-sm bg-card/80 backdrop-blur-sm border-border/60">
            <form onSubmit={handleCreate}>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title <span className="text-destructive">*</span></label>
                  <Input 
                    value={formData.title} 
                    onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} 
                    placeholder="e.g. Frontend Engineer at Acme Corp"
                    required 
                    className="font-medium text-lg"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Type <span className="text-destructive">*</span></label>
                    <Select value={formData.type} onValueChange={(v: OpportunityInputType) => setFormData(p => ({ ...p, type: v }))}>
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
                    <label className="text-sm font-medium">Status <span className="text-destructive">*</span></label>
                    <Select value={formData.status} onValueChange={(v: OpportunityInputStatus) => setFormData(p => ({ ...p, status: v }))}>
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
                  <Input 
                    type="date" 
                    value={formData.deadline || ""} 
                    onChange={e => setFormData(p => ({ ...p, deadline: e.target.value }))} 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">URL</label>
                  <Input 
                    type="url" 
                    value={formData.url} 
                    onChange={e => setFormData(p => ({ ...p, url: e.target.value }))} 
                    placeholder="https://..."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Summary</label>
                  <Textarea 
                    value={formData.summary || ""} 
                    onChange={e => setFormData(p => ({ ...p, summary: e.target.value }))} 
                    placeholder="Brief description of the opportunity..."
                    className="min-h-[100px]" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                    Extracted Tips
                    <span className="text-xs font-normal bg-muted px-2 py-0.5 rounded-full">Optional</span>
                  </label>
                  <Textarea 
                    value={formData.keyActionSteps || ""} 
                    onChange={e => setFormData(p => ({ ...p, keyActionSteps: e.target.value }))} 
                    placeholder="Any specific steps, requirements, or tips extracted from the page..."
                    className="min-h-[80px]" 
                  />
                </div>

              </CardContent>
              <CardFooter className="bg-muted/30 py-4 flex justify-end gap-3 border-t">
                <Button type="button" variant="ghost" onClick={() => setIsManual(false)}>
                  Back
                </Button>
                <Button type="submit" disabled={createOpp.isPending} className="shadow-sm">
                  {createOpp.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  Create Opportunity
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}