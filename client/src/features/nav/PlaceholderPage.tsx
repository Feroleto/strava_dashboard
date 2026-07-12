interface PlaceholderPageProps {
  title: string;
}

export default function PlaceholderPage({ title }: PlaceholderPageProps) {
  return (
    <div className="flex min-h-[520px] flex-col items-center justify-center gap-1.5 p-8 text-center">
      <div className="text-lg font-semibold text-foreground">{title}</div>
      <p className="text-[13px] text-muted-foreground">Coming soon.</p>
    </div>
  );
}
