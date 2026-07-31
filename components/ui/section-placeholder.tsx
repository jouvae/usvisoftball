export type SectionPlaceholderProps = {
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
};

export function SectionPlaceholder({
  title,
  description = "This section is coming soon.",
  className = "",
  children,
}: SectionPlaceholderProps) {
  return (
    <section
      data-testid="section-placeholder"
      className={`mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-16 ${className}`}
    >
      <h1 className="font-display uppercase font-bold tracking-tight text-4xl text-brand">
        {title}
      </h1>
      <p className="text-muted">{description}</p>
      {children}
    </section>
  );
}
