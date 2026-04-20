import React, { useCallback, useRef, useState } from "react";
import { Midi } from "@tonejs/midi";
import * as Tone from "tone";
import { UploadCloud, Loader2 } from "lucide-react";
import useStore from "@/store/useStore";
import { api } from "@/lib/api";
import { useTranslation } from "react-i18next";
import { mergeMidiFiles } from "../../lib/mergeMidiFiles";

interface FileUploadProps {
  inputId?: string;
  hidden?: boolean;
}

const MAX_FILES = 5;

const FileUpload: React.FC<FileUploadProps> = ({ inputId, hidden }) => {
  const setMidiData = useStore((state) => state.setMidiData);
  const setAnalysisData = useStore((state) => state.setAnalysisData);
  const setIsAnalyzing = useStore((state) => state.setIsAnalyzing);
  const resetTrackColors = useStore((state) => state.resetTrackColors);
  const setUseDefaultTrackColors = useStore((state) => state.setUseDefaultTrackColors);
  const analysisSensitivity = useStore((state) => state.analysisSensitivity);
  const analysisComplexity = useStore((state) => state.analysisComplexity);

  const { t } = useTranslation();

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const dedupeFiles = (files: File[]) => {
    const seen = new Set<string>();
    return files.filter((file) => {
      const key = `${file.name}-${file.size}-${file.lastModified}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(e.target.files || []);
    if (incoming.length === 0) return;

    setSelectedFiles((prev) => {
      const merged = dedupeFiles([...prev, ...incoming]).slice(0, MAX_FILES);

      if (prev.length + incoming.length > MAX_FILES || merged.length < prev.length + incoming.length) {
        alert(`最多保留 ${MAX_FILES} 个 MIDI 文件，重复文件会自动忽略。`);
      }

      return merged;
    });

    e.target.value = "";
  }, []);

  const handleClearFiles = useCallback(() => {
    if (busy) return;
    setSelectedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [busy]);

  const handleRemoveFile = useCallback((indexToRemove: number) => {
    if (busy) return;
    setSelectedFiles((prev) => prev.filter((_, index) => index !== indexToRemove));
  }, [busy]);

  const handleConfirmUpload = useCallback(async () => {
    if (selectedFiles.length === 0) {
      alert("你还没有选择任何 MIDI 文件。");
      return;
    }

    setBusy(true);

    try {
      await Tone.start();
    } catch (err) {
      console.warn("[MIDI] Audio context start failed", err);
    }

    try {
      setAnalysisData(null);
      setIsAnalyzing(true);

      const parsed: Midi[] = [];

      for (const file of selectedFiles) {
        const arrayBuffer = await file.arrayBuffer();

        let midi: Midi;
        try {
          midi = new Midi(arrayBuffer);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new Error(`解析失败：${file.name} -> ${message}`);
        }

        parsed.push(midi);
      }

      const { mergedMidi } = mergeMidiFiles(
        parsed,
        selectedFiles.map((f) => f.name)
      );

      if (!mergedMidi || mergedMidi.tracks.length === 0) {
        throw new Error("合并完成，但结果里没有任何轨道。");
      }

      mergedMidi.name =
        selectedFiles.length === 1
          ? selectedFiles[0].name
          : `Merged ${selectedFiles.length} MIDI files`;

      setMidiData(mergedMidi, selectedFiles[0]);

      // 恢复默认按轨道/乐器分色，不再按文件整组刷色
      resetTrackColors();
      setUseDefaultTrackColors(true);

      if (selectedFiles.length === 1) {
        const data = await api.uploadMidi(
          selectedFiles[0],
          analysisComplexity,
          analysisSensitivity
        );
        setAnalysisData(data);
      }
    } catch (error) {
      console.error("[MIDI] Error processing MIDI:", error);
      const message =
        error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      alert(`处理 MIDI 文件时出错：${message}`);
    } finally {
      setIsAnalyzing(false);
      setBusy(false);
    }
  }, [
    selectedFiles,
    setMidiData,
    setAnalysisData,
    setIsAnalyzing,
    resetTrackColors,
    setUseDefaultTrackColors,
    analysisComplexity,
    analysisSensitivity,
  ]);

  const openFilePicker = useCallback(() => {
    if (busy) return;
    fileInputRef.current?.click();
  }, [busy]);

  if (hidden) {
    return (
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept=".mid,.midi"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center w-full max-w-xl mx-auto mt-20 p-8 border-2 border-dashed border-midi-gray rounded-xl bg-midi-dark/50 transition-colors">
      <input
        ref={fileInputRef}
        id={inputId}
        type="file"
        accept=".mid,.midi"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="flex flex-col items-center space-y-4 text-midi-accent/70 w-full">
        <div className="p-4 rounded-full bg-midi-gray">
          {busy ? <Loader2 className="w-8 h-8 animate-spin" /> : <UploadCloud className="w-8 h-8" />}
        </div>

        <div className="text-center">
          <h3 className="text-lg font-medium">
            {t("controls.upload_prompt", {
              defaultValue: "Click to choose MIDI files",
            })}
          </h3>
          <p className="text-sm opacity-70 mt-2">
            最多 5 个文件；可分多次添加；保留默认轨道配色
          </p>
        </div>

        <div className="flex gap-3 flex-wrap justify-center">
          <button
            type="button"
            onClick={openFilePicker}
            disabled={busy}
            className="px-4 py-2 rounded-md bg-blue-600 text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            选择 / 追加文件
          </button>

          <button
            type="button"
            onClick={handleConfirmUpload}
            disabled={selectedFiles.length === 0 || busy}
            className="px-4 py-2 rounded-md bg-green-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {busy ? "处理中..." : "确认上传"}
          </button>

          <button
            type="button"
            onClick={handleClearFiles}
            disabled={selectedFiles.length === 0 || busy}
            className="px-4 py-2 rounded-md bg-gray-600 text-white disabled:opacity-40 disabled:cursor-not-allowed"
          >
            清空
          </button>
        </div>

        <div className="w-full max-w-lg mt-4 bg-black/20 rounded-lg p-4 border border-white/10">
          <div className="text-sm font-medium mb-2">
            已选择文件：{selectedFiles.length} / {MAX_FILES}
          </div>

          {selectedFiles.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {selectedFiles.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${file.lastModified}`}
                  className="flex items-center justify-between rounded-md bg-white/5 px-3 py-2 gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate">
                      {index + 1}. {file.name}
                    </div>
                    <div className="opacity-60 text-xs">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index)}
                    disabled={busy}
                    className="px-2 py-1 rounded bg-red-600 text-white text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    删除
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm opacity-60">
              还没有选择文件。你可以一次选多个，也可以分多次追加。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
