export function Prose({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="container max-w-2xl py-10">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{title}</h1>
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_p]:leading-relaxed">
        {children}
      </div>
    </div>
  );
}
