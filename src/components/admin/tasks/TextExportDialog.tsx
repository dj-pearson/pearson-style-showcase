import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/hooks/use-toast';

interface TextExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tasks: any[];
}

export const TextExportDialog = ({ open, onOpenChange, tasks }: TextExportDialogProps) => {
  const [copied, setCopied] = useState(false);

  const generateTextContent = () => {
    if (tasks.length === 0) return '';

    return tasks.map((task, index) => {
      const lines = [
        `${index + 1}. **${task.title}**`,
      ];

      if (task.category) lines.push(`   - Category: ${task.category}`);
      if (task.priority) lines.push(`   - Priority: ${task.original_priority || task.priority}`);
      if (task.status) lines.push(`   - Status: ${task.status.replace('_', ' ')}`);
      if (task.effort) lines.push(`   - Effort: ${task.effort}`);
      if (task.dependencies) lines.push(`   - Dependencies: ${task.dependencies}`);
      if (task.description) lines.push(`   - Description: ${task.description}`);
      if (task.project?.name) lines.push(`   - Project: ${task.project.name}`);
      if (task.due_date) lines.push(`   - Due: ${new Date(task.due_date).toLocaleDateString()}`);

      return lines.join('\n');
    }).join('\n\n');
  };

  const textContent = generateTextContent();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      toast({ title: 'Copied!', description: `${tasks.length} task(s) copied to clipboard` });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to copy to clipboard', variant: 'destructive' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Export {tasks.length} Task(s) as Text</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Textarea
            value={textContent}
            readOnly
            className="min-h-[400px] font-mono text-sm"
          />
          <div className="flex justify-end">
            <Button onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy to Clipboard
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
