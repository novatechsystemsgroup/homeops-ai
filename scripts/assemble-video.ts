/**
 * Assembles the recorded scenes into a submission video.
 *
 *   pnpm exec tsx scripts/assemble-video.ts --tts=heygen   # voiceover from HeyGen
 *   pnpm exec tsx scripts/assemble-video.ts --tts=say      # local placeholder voice, for timing
 *
 * One segment per scene: the recorded clip, its narration, and a lower-third label.
 * Segments are joined into video/homeops-demo-<plan>.mp4.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const FFMPEG = "/private/tmp/video-tools/node_modules/ffmpeg-static/ffmpeg";
const FFPROBE = "/private/tmp/video-tools/node_modules/ffprobe-static/bin/darwin/arm64/ffprobe";
const FONT = "/System/Library/Fonts/Supplemental/Arial Bold.ttf";
const RAW = "video/raw";
const WORK = "video/work";
const AUDIO = "video/audio";

interface Narration {
  note: string;
  titleCard: { headline: string; sub: string };
  outroCard: { headline: string; sub: string };
  scenes: Array<{ id: string; label: string; text: string }>;
}

const narration = JSON.parse(readFileSync("video/narration.json", "utf8")) as Narration;
const ttsMode = (process.argv.find((arg) => arg.startsWith("--tts="))?.split("=")[1] ?? "heygen") as "heygen" | "say";

function run(command: string, args: string[]): string {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function duration(file: string): number {
  const out = run(FFPROBE, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).trim();
  return Number.parseFloat(out);
}

function readKey(): string {
  const file = join(homedir(), ".config", "homeops", "coolify.env");
  if (!existsSync(file)) return "";
  const match = readFileSync(file, "utf8").match(/^\s*(?:export\s+)?HEYGEN_API_KEY\s*=\s*(.+)$/m);
  return match?.[1]?.trim().replace(/^["']|["']$/g, "") ?? "";
}

async function heyGenVoice(): Promise<string> {
  const key = readKey();
  if (key === "") throw new Error("HEYGEN_API_KEY is missing from ~/.config/homeops/coolify.env");
  const response = await fetch("https://api.heygen.com/v1/audio/voices", { headers: { "X-Api-Key": key } });
  if (!response.ok) throw new Error("HeyGen voices failed with " + response.status);
  // The endpoint returns the list directly under data (older docs showed data.voices).
  const payload = (await response.json()) as {
    data?: Array<{ voice_id: string; language: string; gender: string; name: string }> | {
      voices?: Array<{ voice_id: string; language: string; gender: string; name: string }>;
    };
  };
  const voices = Array.isArray(payload.data) ? payload.data : (payload.data?.voices ?? []);
  const wanted = process.env.HEYGEN_VOICE_ID;
  if (wanted) return wanted;
  const english = voices.filter((voice) => (voice.language ?? "").toLowerCase().startsWith("en"));
  const chosen =
    english.find((voice) => /clear & professional/i.test(voice.name ?? "")) ??
    english.find((voice) => /conversational/i.test(voice.name ?? "")) ??
    english[0] ??
    voices[0];
  if (!chosen) throw new Error("no HeyGen voices available on this account");
  console.log("  voice: " + chosen.name + " (" + chosen.language + ", " + chosen.gender + ")");
  return chosen.voice_id;
}

interface WordTiming { word: string; start: number; end: number }

async function heyGenSpeech(text: string, voiceId: string, output: string): Promise<number> {
  const key = readKey();
  const response = await fetch("https://api.heygen.com/v1/audio/text_to_speech", {
    method: "POST",
    headers: { "X-Api-Key": key, "content-type": "application/json" },
    body: JSON.stringify({ text, voice_id: voiceId, speed: 1.0 })
  });
  if (!response.ok) throw new Error("HeyGen TTS failed with " + response.status + ": " + (await response.text()).slice(0, 200));
  const payload = (await response.json()) as {
    data?: { audio_url?: string; duration?: number; word_timestamps?: WordTiming[] };
  };
  const url = payload.data?.audio_url;
  if (!url) throw new Error("HeyGen returned no audio_url: " + JSON.stringify(payload).slice(0, 200));
  const audio = await fetch(url);
  writeFileSync(output, Buffer.from(await audio.arrayBuffer()));

  // Word timings let the video carry captions for judges watching without sound.
  const words = payload.data?.word_timestamps ?? [];
  if (words.length > 0) writeFileSync(output.replace(/\.(mp3|wav)$/, ".words.json"), JSON.stringify(words));
  return payload.data?.duration ?? 0;
}

function saySpeech(text: string, output: string): void {
  const aiff = output.replace(/\.mp3$/, ".aiff");
  run("say", ["-v", "Daniel", "-r", "185", "-o", aiff, text]);
  run(FFMPEG, ["-y", "-loglevel", "error", "-i", aiff, "-codec:a", "libmp3lame", "-q:a", "4", output]);
}

/**
 * Fits the clip to its narration without hiding anything that happened on screen: a long clip
 * is played faster (the model's thinking time becomes a few seconds of visible progress) and a
 * short clip is held on its last frame instead of cutting the voice off.
 */
function fitToNarration(audioSeconds: number, clipSeconds: number): { filter: string; seconds: number } {
  const target = audioSeconds + 1.0;
  const speed = Math.min(2.4, Math.max(0.75, clipSeconds / target));
  const played = clipSeconds / speed;
  const hold = Math.max(0, target - played);
  const filters = ["setpts=PTS/" + speed.toFixed(3)];
  if (hold > 0.05) filters.push("tpad=stop_mode=clone:stop_duration=" + hold.toFixed(2));
  return { filter: filters.join(","), seconds: target };
}


/**
 * Builds the caption filter from the TTS word timings.
 *
 * Each cue is drawn with drawtext rather than a subtitle file: libass ignored the styling and
 * rendered the narration at its own default size over the whole frame, and drawtext also lets
 * the captions sit exactly above the lower-third label. Text goes through files so apostrophes
 * and punctuation never have to be escaped.
 */
function captionFilters(words: WordTiming[], offsetSeconds: number, workDir: string): string {
  const spoken = words.filter((word) => word.word.trim() !== "" && !/^<.*>$/.test(word.word.trim()));
  const cues: Array<{ from: number; to: number; text: string }> = [];
  let line: string[] = [];
  let from = 0;

  const flush = (to: number): void => {
    if (line.length === 0) return;
    cues.push({ from: from + offsetSeconds, to: to + offsetSeconds, text: line.join(" ") });
    line = [];
  };

  for (const word of spoken) {
    if (line.length === 0) from = word.start;
    line.push(word.word.trim());
    if (line.length >= 7 || line.join(" ").length >= 46) flush(word.end);
  }
  const last = spoken[spoken.length - 1];
  if (last) flush(last.end);

  return cues
    .map((cue, index) => {
      const file = join(workDir, "cue-" + index + ".txt");
      writeFileSync(file, cue.text.replace(/[\r\n]/g, " "));
      const window = "enable='between(t," + cue.from.toFixed(2) + "," + cue.to.toFixed(2) + ")'";
      return (
        "drawtext=fontfile='" + FONT + "':textfile='" + resolve(file) + "':x=(w-tw)/2:y=h-236:fontsize=29:" +
        "fontcolor=0xffffff:box=1:boxcolor=0x0b1220@0.55:boxborderw=13:" + window
      );
    })
    .join(",");
}

function legacyWriteCaptionsRemoved(words: WordTiming[], offsetSeconds: number, output: string): void {
  const header = [
    "[Script Info]",
    "ScriptType: v4.00+",
    "PlayResX: 1920",
    "PlayResY: 1080",
    "WrapStyle: 2",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    "Style: Caption,Arial,40,&H00FFFFFF,&H000000FF,&H00202020,&H80000000,-1,0,0,0,100,100,0,0,1,1.6,1,2,120,120,210,1",
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text"
  ];

  const clock = (value: number): string => {
    const total = Math.max(0, value + offsetSeconds);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = Math.floor(total % 60);
    const centis = Math.round((total % 1) * 100);
    return hours + ":" + String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0") + "." + String(centis).padStart(2, "0");
  };

  // The provider also returns marker tokens such as <start>: they are not speech.
  const spoken = words.filter((word) => word.word.trim() !== "" && !/^<.*>$/.test(word.word.trim()));
  const cues: string[] = [];
  let line: string[] = [];
  let from = 0;

  const flush = (to: number): void => {
    if (line.length === 0) return;
    cues.push("Dialogue: 0," + clock(from) + "," + clock(to) + ",Caption,,0,0,0,," + line.join(" "));
    line = [];
  };

  for (const word of spoken) {
    if (line.length === 0) from = word.start;
    line.push(word.word.trim());
    if (line.length >= 7 || line.join(" ").length >= 46) flush(word.end);
  }
  const last = spoken[spoken.length - 1];
  if (last) flush(last.end);

  writeFileSync(output, header.concat(cues).join("\n") + "\n");
}

function lowerThird(label: string): string {
  const text = label.replace(/:/g, "\\:").replace(/'/g, "");
  return (
    "drawbox=x=60:y=ih-150:w=iw-120:h=74:color=0x0b1220@0.72:t=fill," +
    "drawtext=fontfile='" + FONT + "':text='" + text + "':x=88:y=h-132:fontsize=34:fontcolor=0xe2e8f0"
  );
}

function cardSegment(headline: string, sub: string, seconds: number, output: string): void {
  const head = headline.replace(/:/g, "\\:").replace(/'/g, "");
  const subline = sub.replace(/:/g, "\\:").replace(/'/g, "");
  run(FFMPEG, [
    "-y", "-loglevel", "error",
    "-f", "lavfi", "-i", "color=c=0x0b1220:s=1920x1080:d=" + seconds,
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
    "-vf",
    "drawtext=fontfile='" + FONT + "':text='" + head + "':x=(w-tw)/2:y=(h/2)-90:fontsize=86:fontcolor=0xffffff," +
      "drawtext=fontfile='" + FONT + "':text='" + subline + "':x=(w-tw)/2:y=(h/2)+30:fontsize=34:fontcolor=0x93c5fd",
    "-t", String(seconds), "-r", "30", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
    "-shortest", output
  ]);
}

async function main(): Promise<void> {
  mkdirSync(WORK, { recursive: true });
  mkdirSync(AUDIO, { recursive: true });

  const voiceId = ttsMode === "heygen" ? await heyGenVoice() : "";
  const parts: string[] = [];

  const title = join(WORK, "00-title.mp4");
  cardSegment(narration.titleCard.headline, narration.titleCard.sub, 4, title);
  parts.push(title);

  for (const scene of narration.scenes) {
    const clip = join(RAW, scene.id + ".webm");
    if (!existsSync(clip)) {
      console.log("  missing clip for " + scene.id + ", skipped");
      continue;
    }
    const audio = join(AUDIO, scene.id + ".mp3");
    const wordsFile = audio.replace(/\.(mp3|wav)$/, ".words.json");
    const captionDir = join(WORK, "cues-" + scene.id);
    mkdirSync(captionDir, { recursive: true });
    if (!existsSync(audio)) {
      if (ttsMode === "heygen") await heyGenSpeech(scene.text, voiceId, audio);
      else saySpeech(scene.text, audio);
    }
    const captionFilter =
      ttsMode === "heygen" && existsSync(wordsFile)
        ? captionFilters(JSON.parse(readFileSync(wordsFile, "utf8")) as WordTiming[], 0.4, captionDir)
        : "";

    const clipSeconds = duration(clip);
    const audioSeconds = duration(audio);
    const segment = join(WORK, scene.id + ".mp4");
    const fitted = fitToNarration(audioSeconds, clipSeconds);
    const graph =
      "[0:v]scale=1920:1080,fps=30," + fitted.filter + "," + lowerThird(scene.label) + (captionFilter !== "" ? "," + captionFilter : "") + "[v];" +
      "[1:a]adelay=400|400,volume=1.0[a]";
    const filter = graph;
      // A short lead-in so the picture is on screen before the voice starts.
      "[1:a]adelay=400|400,volume=1.0[a]";

    run(FFMPEG, [
      "-y", "-loglevel", "error",
      "-i", clip, "-i", audio,
      "-filter_complex", filter,
      "-map", "[v]", "-map", "[a]",
      "-t", fitted.seconds.toFixed(2),
      "-r", "30", "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2",
      segment
    ]);
    console.log(
      "  " + scene.id + ": clip " + clipSeconds.toFixed(1) + "s, voice " + audioSeconds.toFixed(1) +
        "s -> " + fitted.seconds.toFixed(1) + "s"
    );
    parts.push(segment);
  }

  const outro = join(WORK, "99-outro.mp4");
  cardSegment(narration.outroCard.headline, narration.outroCard.sub, 4, outro);
  parts.push(outro);

  const listFile = join(WORK, "concat.txt");
  // Absolute paths: ffmpeg resolves entries in a concat list relative to the list itself.
  writeFileSync(listFile, parts.map((part) => "file '" + resolve(part) + "'").join("\n"));
  const output = "video/homeops-demo.mp4";
  run(FFMPEG, ["-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", listFile, "-c", "copy", output]);

  console.log("  total: " + duration(output).toFixed(1) + "s -> " + output);
  process.exit(0);
}

void main();
