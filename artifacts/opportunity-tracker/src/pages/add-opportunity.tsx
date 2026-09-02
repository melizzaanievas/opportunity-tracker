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
            summary: data.summary?.trim() || "",
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
            description: err.data?.error || "Please check your inputs.",
            variant: "destructive"
          });
        }
      }
    );
  };

  return (
    <AppLayout>
      <div className="new-opportunity-page max-w-2xl mx-auto space-y-6 pb-12">
        <Button variant="ghost" size="sm" asChild className="new-opportunity-back -ml-3">
          <Link href="/dashboard"><ArrowLeft className="w-4 h-4 mr-2" /> Back</Link>
        </Button>

        <div className="mb-8">
          <h1 className="new-opportunity-title text-4xl font-serif font-bold tracking-tight mb-2">New Opportunity</h1>
          <p className="new-opportunity-description">Add a job, grant, or hackathon you want to track.</p>
        </div>

        {!isManual ? (
          <Card className="magic-import-panel">
            <CardHeader>
              <CardTitle className="magic-import-title flex items-center gap-2">
                <Wand2 className="w-5 h-5" />
                Magic Import
              </CardTitle>
              <CardDescription className="magic-import-description">
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
                  className="new-opportunity-input flex-1"
                  required
                />
                <Button type="submit" className="new-opportunity-primary-button" disabled={scrapeUrl.isPending || !scrapeInputUrl}>
                  {scrapeUrl.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                  Import
                </Button>
              </form>
            </CardContent>
            <CardFooter className="pt-0">
              <Button variant="link" size="sm" onClick={() => setIsManual(true)} className="new-opportunity-skip-button px-0">
                Skip and enter manually
              </Button>
            </CardFooter>
          </Card>
        ) : (
          <Card className="new-opportunity-form-panel">
            <form onSubmit={handleCreate}>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-2">
                  <label className="new-opportunity-label">Title <span className="text-destructive">*</span></label>
                  <Input 
                    value={formData.title} 
                    onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} 
                    placeholder="e.g. Frontend Engineer at Acme Corp"
                    required 
                    className="new-opportunity-input font-medium text-lg"
                  />
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="new-opportunity-label">Type <span className="text-destructive">*</span></label>
                    <Select value={formData.type} onValueChange={(v: OpportunityInputType) => setFormData(p => ({ ...p, type: v }))}>
                      <SelectTrigger className="new-opportunity-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="job">Job</SelectItem>
                        <SelectItem value="grant">Grant</SelectItem>
                        <SelectItem value="hackathon">Hackathon</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="new-opportunity-label">Status <span className="text-destructive">*</span></label>
                    <Select value={formData.status} onValueChange={(v: OpportunityInputStatus) => setFormData(p => ({ ...p, status: v }))}>
                      <SelectTrigger className="new-opportunity-select"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="to-apply">To Apply</SelectItem>
                        <SelectItem value="applied">Applied</SelectItem>
                        <SelectItem value="interviewing">Interviewing</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="new-opportunity-label">Deadline</label>
                  <Input 
                    type="date" 
                    value={formData.deadline || ""} 
                    onChange={e => setFormData(p => ({ ...p, deadline: e.target.value }))} 
                    className="new-opportunity-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="new-opportunity-label">URL</label>
                  <Input 
                    type="url" 
                    value={formData.url} 
                    onChange={e => setFormData(p => ({ ...p, url: e.target.value }))} 
                    placeholder="https://..."
                    required
                    className="new-opportunity-input"
                  />
                </div>

                <div className="space-y-2">
                  <label className="new-opportunity-label">Summary</label>
                  <Textarea 
                    value={formData.summary || ""} 
                    onChange={e => setFormData(p => ({ ...p, summary: e.target.value }))} 
                    placeholder="Brief description of the opportunity..."
                    className="new-opportunity-input min-h-[100px]" 
                  />
                </div>

                <div className="space-y-2">
                  <label className="new-opportunity-label flex items-center justify-between">
                    Extracted Tips
                    <span className="new-opportunity-optional">Optional</span>
                  </label>
                  <Textarea 
                    value={formData.keyActionSteps || ""} 
                    onChange={e => setFormData(p => ({ ...p, keyActionSteps: e.target.value }))} 
                    placeholder="Any specific steps, requirements, or tips extracted from the page..."
                    className="new-opportunity-input min-h-[80px]" 
                  />
                </div>

              </CardContent>
              <CardFooter className="new-opportunity-form-footer py-4 flex justify-end gap-3">
                <Button type="button" variant="ghost" onClick={() => setIsManual(false)} className="new-opportunity-skip-button">
                  Back
                </Button>
                <Button type="submit" disabled={createOpp.isPending} className="new-opportunity-primary-button">
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