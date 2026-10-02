import { Link } from '@tanstack/react-router';

export function NotFoundPage() {
  return (
    <section className="empty-state">
      <h2>Page not found</h2>
      <p>This address doesn’t match a workspace page.</p>
      <Link to="/">Go to Board</Link>
    </section>
  );
}
