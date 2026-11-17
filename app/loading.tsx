export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="skel h-9 w-64" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel h-28" />)}
      </div>
      <div className="skel h-80" />
    </div>
  );
}