import { useNavigate } from "react-router-dom";
import { Button } from "@/components/common/Button";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <p className="text-5xl font-bold tracking-tight text-accent">404</p>
      <p className="mt-3 text-lg font-semibold">Page not found</p>
      <p className="mt-1 text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist in AIRINDEX.
      </p>
      <Button className="mt-5" onClick={() => navigate("/dashboard")}>
        Back to dashboard
      </Button>
    </div>
  );
}
