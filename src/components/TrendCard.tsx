
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface TrendCardProps {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}

const TrendCard = ({ title, icon: Icon, children }: TrendCardProps) => {
  return (
    <Card className="animate-fade-in">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium flex items-center">
          <Icon className="mr-2 h-5 w-5 text-insta-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};

export default TrendCard;
