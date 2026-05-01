import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, User, Mail } from "lucide-react";

const Configuracoes = () => {
  const { user, signOut } = useAuth();
  return (
    <PageHeader title="Configurações" description="Sua conta">
      <Card className="p-6 max-w-xl">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center text-primary-foreground shadow-soft">
            <User className="w-6 h-6" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold">Sua conta</p>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5 truncate"><Mail className="w-3.5 h-3.5" />{user?.email}</p>
          </div>
        </div>
        <Button variant="destructive" onClick={signOut} className="w-full sm:w-auto">
          <LogOut className="w-4 h-4 mr-2" /> Sair da conta
        </Button>
      </Card>
    </PageHeader>
  );
};
export default Configuracoes;
