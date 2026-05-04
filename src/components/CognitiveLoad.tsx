export const CognitiveLoad = ({ value }: { value: number }) => (
  <div className="flex items-center gap-1" title={`Cognitive load: ${value}/5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <div
        key={i}
        className={`h-1.5 w-1.5 rounded-full ${i <= value ? "bg-primary" : "bg-muted"}`}
      />
    ))}
  </div>
);
