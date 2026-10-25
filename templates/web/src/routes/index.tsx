import { Badge, Card } from "@pands/ui";
import { navItems } from "../nav.js";

export default function IndexPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Welcome to your Pand App</h1>
        <p className="mt-1 text-sm text-slate-600">
          Select an entity from the sidebar or add new entities with{" "}
          <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">pand add entity</code>.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {navItems.map((item) => (
          <Card key={item.to} className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-slate-900">{item.label}</div>
              <div className="text-xs text-slate-500">{item.to}</div>
            </div>
            <Badge variant="default">Route</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}
