import { MapPin } from 'lucide-react';

export function Opportunity() {
  return (
    <div className="journey-opportunity">
      <p className="fictional-label">Fictional example</p>
      <div className="journey-job">
        <span className="opportunity-avatar" aria-hidden="true">
          F
        </span>
        <div>
          <p className="opportunity-company">Forma</p>
          <p className="opportunity-title">Design Engineer</p>
        </div>
      </div>
      <p className="opportunity-location">
        <MapPin size={15} aria-hidden="true" /> Berlin · Hybrid <span>€80k–€100k</span>
      </p>
    </div>
  );
}
