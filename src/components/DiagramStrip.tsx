/* Shows the diagram images cropped from the uploaded task sheet. */
export default function DiagramStrip({ diagrams, small = false }: { diagrams: string; small?: boolean }) {
  let imgs: string[] = [];
  try {
    imgs = JSON.parse(diagrams || "[]");
  } catch {}
  if (imgs.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-3">
      {imgs.map((src, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={src}
          alt={`Diagram ${i + 1} from the task sheet`}
          className={`rounded-lg border border-line bg-white ${small ? "max-h-36" : "max-h-80"} w-auto max-w-full`}
        />
      ))}
    </div>
  );
}
