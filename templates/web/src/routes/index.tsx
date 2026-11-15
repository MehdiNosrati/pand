import "@methane-ui/ui/badge";
import "@methane-ui/ui/card";
import { navItems } from "../nav.js";

export default function IndexPage({ onNavigate }: { onNavigate?: (to: string) => void }) {
  return (
    <div className="mth-stack" data-gap="6">
      <div>
        <h1 className="pand-title">Welcome to your Pand App</h1>
        <p className="pand-subtitle">
          Select an entity from the sidebar or add new entities with <code>pand add entity</code>.
        </p>
      </div>
      <div className="mth-grid" data-cols="3" data-gap="4">
        {navItems.map((item) => (
          <a
            key={item.to}
            href={item.to}
            className="pand-card-link"
            onClick={(e) => {
              e.preventDefault();
              onNavigate?.(item.to);
            }}
          >
            <mth-card variant="outlined" interactive>
              <div className="mth-flex" data-justify="between" data-align="center">
                <div>
                  <div className="pand-card-title">{item.label}</div>
                  <div className="pand-card-path">{item.to}</div>
                </div>
                <mth-badge variant="accent" pill>
                  Route
                </mth-badge>
              </div>
            </mth-card>
          </a>
        ))}
      </div>
    </div>
  );
}
