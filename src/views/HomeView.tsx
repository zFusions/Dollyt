import { FormEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import { PrimaryButton } from "../components/PrimaryButton";
import { useDollytStore, type VideoInfo } from "../store";

export function HomeView() {
  const url = useDollytStore((s) => s.url);
  const setUrl = useDollytStore((s) => s.setUrl);
  const setVideo = useDollytStore((s) => s.setVideo);
  const setStatus = useDollytStore((s) => s.setStatus);
  const goEditor = useDollytStore((s) => s.goEditor);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus("Ouverture de la vidéo…");
    try {
      const loaded = await invoke<VideoInfo>("load_video", { rawUrl: url });
      setVideo(loaded);
      setStatus("");
      goEditor();
    } catch (err) {
      setStatus(String(err));
    }
  }

  return (
    <section className="flex min-h-[70vh] flex-col justify-center gap-8 border-t border-line pt-10">
      <p className="font-serif text-3xl text-text md:text-4xl">
        Colle un lien YouTube
      </p>
      <form onSubmit={onSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-stretch">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-0 flex-1 border border-line bg-surface px-3 py-3 font-sans text-sm text-text placeholder:text-text-faint focus:border-line-strong"
          placeholder="https://"
          autoFocus
        />
        <PrimaryButton type="submit" className="sm:self-stretch">
          Ouvrir
        </PrimaryButton>
      </form>
      <p className="font-mono text-xs text-text-faint">
        Extraits pour TikTok, Reels et Shorts — source YouTube uniquement.
      </p>
    </section>
  );
}
