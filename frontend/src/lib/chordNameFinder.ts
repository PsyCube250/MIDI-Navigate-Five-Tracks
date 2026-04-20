import { Chord, Note } from "@tonaljs/tonal";

export type ExperimentalChordResult = {
  name: string;
  confidence: number;
  quality: string;
};

function midiToPitchClasses(midiNumbers: number[]): string[] {
  const pcs = midiNumbers
    .map((m) => Note.pitchClass(Note.fromMidi(m)))
    .filter(Boolean) as string[];

  return [...new Set(pcs)];
}

export function detectChord(midiNumbers: number[]): ExperimentalChordResult[] {
  if (!midiNumbers || midiNumbers.length < 2) return [];

  const pitchClasses = midiToPitchClasses(midiNumbers);
  const names = Chord.detect(pitchClasses);

  if (!names || names.length === 0) return [];

  return names.map((name, i) => ({
    name,
    confidence: Math.max(0.3, 0.9 - i * 0.1),
    quality: name,
  }));
}
