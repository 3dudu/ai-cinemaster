import { AudioLines, AudioWaveform, Download, Loader2, Mic, Settings, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { VOICE_LIBRARY, VOICE_LIBRARY_TYPE_NAMES } from '../config/voiceLibrary';
import { ModelService } from '../services/modelService';
import { addMediaHistory } from '../services/storageService';
import { Character, ProjectState, Shot, TtsParams } from '../types';
import { useDialog } from './dialog';

interface VoiceSynthesisModalProps {
  isOpen: boolean;
  onClose: () => void;
  character: Character;
  project: ProjectState;
  updateProject: (updates: Partial<ProjectState>) => void;
}

const VoiceSynthesisModal: React.FC<VoiceSynthesisModalProps> = ({
  isOpen,
  onClose,
  character,
  project,
  updateProject
}) => {
  const dialog = useDialog();
  const [ttsParams, setTtsParams] = useState<TtsParams>({
    spd: 5,
    pit: 5,
    vol: 5,
    per: 0
  });
  const [selectedVoiceLibrary, setSelectedVoiceLibrary] = useState<string>('all');
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewAudio, setPreviewAudio] = useState<string | null>(null);
  const [generatedVoiceUrl, setGeneratedVoiceUrl] = useState<string | null>(null);
  const [dialogueText, setDialogueText] = useState<string>('');
  const [showPreviewPlayer, setShowPreviewPlayer] = useState(false);

  // Load character's TTS params and voice URL when modal opens
  useEffect(() => {
    if (isOpen && character) {
      if (character.ttsParams) {
        setTtsParams(character.ttsParams);
      }
      if (character.voiceUrl) {
        setGeneratedVoiceUrl(character.voiceUrl);
      }
      setDialogueText(extractCharacterDialogue());
      setPreviewAudio(null);
      setShowPreviewPlayer(true);
    }
  }, [isOpen, character]);

  // Extract all dialogue for this character from all shots
  const extractCharacterDialogue = (): string => {
    if (!project.shots || project.shots.length === 0) {
      return '未找到角色对话';
    }
    const dialogues: string[] = [];
    project.shots.forEach((shot: Shot) => {
      if (shot.dialogue && shot.dialogue instanceof Array && shot.dialogue.length > 0 ) {
        shot.dialogue.forEach((d) => {
          // Check if this dialogue belongs to current character
          const belongsToCharacter = shot.characters.includes(character.id) ||d.character === character.name;
          if (belongsToCharacter) {
            dialogues.push(d.value);
          }
        });
      }
    });
    if (dialogues.length === 0) {
      return `角色 ${character.name} 在当前剧本中没有对话`;
    }
    return dialogues.join('\n');
  };

  const handleGenerateVoice = async () => {
    if (!dialogueText.trim()) return;

    // Show confirmation dialog if already has generated voice
    if (generatedVoiceUrl) {
      const confirmed = await dialog.confirm({
        title: '确认重新合成',
        message: '将覆盖当前已合成的语音，是否继续？',
        type: 'warning'
      });
      if (!confirmed) return;
    }

    setIsGenerating(true);

    try {
      const voiceUrl = await ModelService.generateSpeechUrl(dialogueText, {}, ttsParams, project.id);
      setGeneratedVoiceUrl(voiceUrl);

      // Save to character
      const newData = { ...project.scriptData! };
      const char = newData.characters.find(c => c.id === character.id);
      if (char) {
        char.voiceUrl = voiceUrl;
        char.ttsParams = ttsParams;
        updateProject({ scriptData: newData });
      }

      // Save to media history
      await addMediaHistory(project.id, voiceUrl, `${character.name}_语音`, 'audio', 'character');

    } catch (error) {
      console.error('Voice generation failed:', error);
      await dialog.alert({
        title: '错误',
        message: `语音合成失败: ${error.message || '未知错误'}`,
        type: 'error'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePreview = async () => {
    if (!dialogueText.trim()) return;
    setIsGenerating(true);

    try {
      // Preview with first 50 characters
      const previewText = dialogueText.slice(0, 50);
      const previewUrl = await ModelService.generateSpeechUrl(previewText, {}, ttsParams, project.id,true);
      setPreviewAudio(previewUrl);
      setShowPreviewPlayer(true);
      // Auto play preview
      const audio = new Audio(previewUrl);
      audio.play();
    } catch (error) {
      console.error('Preview generation failed:', error);
      await dialog.alert({
        title: '错误',
        message: `预览生成失败: ${error.message || '未知错误'}`,
        type: 'error'
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Play generated voice
  const handlePlayGenerated = () => {
    if (generatedVoiceUrl) {
      const audio = new Audio(generatedVoiceUrl);
      audio.play();
    }
  };

  // Download audio
  const downloadAudio = async (audioUrl: string, filename: string) => {
    try {
      const response = await fetch(audioUrl);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Download failed:', error);
      await dialog.alert({
        title: '错误',
        message: `下载失败，请重试。${error?.message || ''}`,
        type: 'error'
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-600 w-full max-w-2xl max-h-[85vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between shrink-0 bg-slate-600/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-700 rounded-lg">
              <Mic className="w-5 h-5 text-slate-300" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-50">语音合成</h3>
              <p className="text-xs text-slate-400">{character.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto md:p-6 p-2 bg-slate-700">
          <div className="space-y-4 md:space-y-6">
            {/* Character Info */}
            <div className="bg-slate-800 p-4 rounded-xl border border-slate-600">
              <div className="flex items-start gap-3">
                <div className="w-16 h-16 bg-slate-700 rounded-lg overflow-hidden shrink-0 border border-slate-600">
                  {character.referenceImage ? (
                    <img src={character.referenceImage} className="w-full h-full object-cover" alt={character.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-600">
                      <Mic className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-200 mb-1">{character.name}</h4>
                  <p className="text-xs text-slate-400 mb-2">
                    {character.gender} · {character.age} · {character.personality}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 flex items-center gap-2">
              {generatedVoiceUrl && (
                <>
                  <audio
                    controls
                    src={generatedVoiceUrl}
                    className="h-8 flex-1 w-full"
                    />
                  <button
                    onClick={() => downloadAudio(generatedVoiceUrl, `${character.name}_语音.mp3`)}
                    className="px-3 py-2 bg-slate-500 hover:bg-slate-400 text-slate-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                    title="下载语音"
                    >
                    <Download className="w-4 h-4" />
                  </button>
                </>
              )}
              </div>
              <button
                onClick={handleGenerateVoice}
                disabled={isGenerating}
                className="px-3 py-2 bg-slate-500 hover:bg-slate-400 text-slate-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
                title={generatedVoiceUrl ? "重新合成" : "合成语音"}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <AudioLines className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Dialogue Text Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-300">角色台词</label>
                <span className="text-xs text-slate-500">{dialogueText.length} 字符</span>
              </div>
              <textarea
                value={dialogueText}
                onChange={(e) => setDialogueText(e.target.value)}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg p-3 max-h-48 overflow-y-auto text-xs text-slate-300 whitespace-pre-wrap font-mono focus:border-slate-500 focus:outline-none transition-all resize-none"
                placeholder="输入要合成的台词..."
                rows={6}
              />
            </div>

            {/* TTS Settings */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-2">
                <Settings className="w-4 h-4 text-slate-400" />
                <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider">语音参数设置</h4>
              </div>

              {/* Voice Library Selection */}
              <div className="bg-slate-800 p-3 rounded-xl border border-slate-600">
              <div className="flex items-center gap-3">
                {/* Voice Library Filter */}
                <div className="flex-1 min-w-0">
                  <select
                    value={selectedVoiceLibrary}
                    onChange={(e) => setSelectedVoiceLibrary(e.target.value)}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-50 px-2 py-2 text-xs rounded-md appearance-none focus:border-slate-500 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="all">全部音色</option>
                    <option value="basic">基础音库</option>
                    <option value="premium">精品音库</option>
                    <option value="exquisite">臻品音库</option>
                    <option value="llm">大模型音库</option>
                  </select>
                </div>

                {/* Voice Person */}
                <div className="flex-1 min-w-0">
                  <select
                    value={ttsParams.per}
                    onChange={(e) => setTtsParams({ ...ttsParams, per: parseInt(e.target.value) })}
                    className="w-full bg-slate-700 border border-slate-600 text-slate-50 px-2 py-2 text-xs rounded-md appearance-none focus:border-slate-500 focus:outline-none transition-all cursor-pointer"
                  >
                    {selectedVoiceLibrary === 'all' ? (
                      VOICE_LIBRARY.map((voice) => (
                        <option key={voice.per} value={voice.per}>
                          {voice.name} ({VOICE_LIBRARY_TYPE_NAMES[voice.library]})
                        </option>
                      ))
                    ) : (
                      VOICE_LIBRARY.filter(v => v.library === selectedVoiceLibrary).map((voice) => (
                        <option key={voice.per} value={voice.per}>
                          {voice.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Preview Button */}
                <button
                  onClick={handlePreview}
                  disabled={isGenerating}
                  className="cursor-pointer px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-md text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </>
                  ) : (
                    <>
                      <AudioWaveform className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
                 {/* Voice Info */}
                  {(() => {
                    const selectedVoice = VOICE_LIBRARY.find(v => v.per === ttsParams.per);
                    if (!selectedVoice) return null;
                    return (
                      <div className="mt-2 text-[10px] text-slate-500">
                        <span className="inline-block px-1.5 py-0.5 bg-slate-700 rounded mr-1">
                          {VOICE_LIBRARY_TYPE_NAMES[selectedVoice.library]}
                        </span>
                        <span className="inline-block px-1.5 py-0.5 bg-slate-700 rounded mr-1">
                          {selectedVoice.scene}
                        </span>
                        <span className="inline-block px-1.5 py-0.5 bg-slate-700 rounded">
                          {selectedVoice.languages}
                        </span>
                      </div>
                    );
                  })()}
              </div>
              {/* Speed, Pitch, Volume */}
              <div className="grid grid-cols-3 gap-2">
                {/* Speed */}
                <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-600">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">语速</label>
                    <span className="text-xs text-slate-400 font-mono">{ttsParams.spd}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={ttsParams.spd}
                    onChange={(e) => setTtsParams({ ...ttsParams, spd: parseInt(e.target.value) })}
                    className="w-full accent-slate-400 cursor-pointer"
                  />
                </div>

                {/* Pitch */}
                <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-600">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">音调</label>
                    <span className="text-xs text-slate-400 font-mono">{ttsParams.pit}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={ttsParams.pit}
                    onChange={(e) => setTtsParams({ ...ttsParams, pit: parseInt(e.target.value) })}
                    className="w-full accent-slate-400 cursor-pointer"
                  />
                </div>

                {/* Volume */}
                <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-600">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-medium text-slate-300">音量</label>
                    <span className="text-xs text-slate-400 font-mono">{ttsParams.vol}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="15"
                    value={ttsParams.vol}
                    onChange={(e) => setTtsParams({ ...ttsParams, vol: parseInt(e.target.value) })}
                    className="w-full accent-slate-400 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceSynthesisModal;
