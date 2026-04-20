import { Midi } from "@tonejs/midi";

export type MidiGroupInfo = {
  groupId: number;
  fileName: string;
  color: string;
  trackIndices: number[];
};

export type MergeResult = {
  mergedMidi: Midi;
  groups: MidiGroupInfo[];
};

const GROUP_COLORS = [
  "#ff6b6b",
  "#4dabf7",
  "#51cf66",
  "#ffd43b",
  "#b197fc",
];

// 你刚刚实测“上一版是 120 BPM”
// 按等比例换算，最接近 70 的其实就是恢复到 1.0
const TARGET_BPM = 70;
const TIME_SCALE = 1.0;

export function mergeMidiFiles(midis: Midi[], fileNames: string[]): MergeResult {
  const mergedMidi = new Midi();
  const groups: MidiGroupInfo[] = [];

  if (midis.length === 0) {
    return { mergedMidi, groups };
  }

  // 只统一 header tempo；note 本身不再额外缩放
  mergedMidi.header.tempos = [{ ticks: 0, bpm: TARGET_BPM, time: 0 }];

  midis.forEach((srcMidi, groupId) => {
    const color = GROUP_COLORS[groupId % GROUP_COLORS.length];
    const trackIndices: number[] = [];

    srcMidi.tracks.forEach((srcTrack, trackIndex) => {
      const newTrack = mergedMidi.addTrack();

      newTrack.name =
        srcTrack.name || `${fileNames[groupId]} - Track ${trackIndex + 1}`;

      if (typeof srcTrack.channel === "number") {
        newTrack.channel = srcTrack.channel;
      }

      if (
        srcTrack.instrument &&
        typeof srcTrack.instrument.number === "number"
      ) {
        newTrack.instrument.number = srcTrack.instrument.number;
      }

      srcTrack.notes.forEach((note) => {
        newTrack.addNote({
          midi: note.midi,
          time: note.time * TIME_SCALE,
          duration: note.duration * TIME_SCALE,
          velocity: note.velocity,
        });
      });

      trackIndices.push(mergedMidi.tracks.length - 1);
    });

    groups.push({
      groupId,
      fileName: fileNames[groupId],
      color,
      trackIndices,
    });
  });

  return { mergedMidi, groups };
}
