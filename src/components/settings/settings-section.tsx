export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="card scroll-mt-24 p-4 md:p-6">
      <header className="mb-5 flex flex-col gap-1">
        <h2 className="text-h2">{title}</h2>
        {description ? <p className="text-body text-muted-foreground">{description}</p> : null}
      </header>
      {children}
    </section>
  );
}
