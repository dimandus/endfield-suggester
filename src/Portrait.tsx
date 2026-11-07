import { convertFileSrc } from "@tauri-apps/api/core";

export default function Portrait({ path, alt }: { path?: string | null; alt: string }) {
  if (!path) {
    return (
      <div className="portrait placeholder" aria-label={alt}>
        ?
      </div>
    );
  }

  return <img className="portrait" src={convertFileSrc(path)} alt={alt} />;
}
