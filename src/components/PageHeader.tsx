import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface Props {
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  children: ReactNode;
}

export const PageHeader = ({ title, description, action, children }: Props) => (
  <div className="space-y-6 max-w-7xl mx-auto">
    <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      {action && (
        <Button onClick={action.onClick} size="lg" className="shadow-soft">
          <Plus className="w-4 h-4 mr-2" /> {action.label}
        </Button>
      )}
    </header>
    {children}
  </div>
);
