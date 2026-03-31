import { Film, Save, X } from 'lucide-react';
import React, { useState } from 'react';
import { Character, Scene, Segment, Shot } from '../../types';
import CustomSelect from '../common/CustomSelect';

interface SegmentEditModalProps {
  segment: Segment;
  allShots: Shot[];
  allCharacters: Character[];
  allScenes: Scene[];
  getCharacterWithAssets?: (charId: string) => Character | null;
  getSceneWithAssets?: (sceneId: string) => Scene | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedSegment: Segment) => void;
}

// Shot thumbnail component
const ShotThumbnail: React.FC<{ shot: Shot; isSelected?: boolean }> = ({ shot, isSelected }) => {
  const thumbnail = shot.keyframes?.find((k) => k.type === 'start')?.imageUrl;
  return (
    <div className={`w-12 h-8 rounded overflow-hidden flex-shrink-0 ${isSelected ? 'ring-2 ring-indigo-500' : ''}`}>
      {thumbnail ? (
        <img src={thumbnail} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-slate-700 flex items-center justify-center">
          <Film className="w-3 h-3 text-slate-600" />
        </div>
      )}
    </div>
  );
};

const SegmentEditModal: React.FC<SegmentEditModalProps> = ({
  segment,
  allShots,
  allCharacters,
  allScenes,
  getCharacterWithAssets,
  getSceneWithAssets,
  isOpen,
  onClose,
  onSave,
}) => {
  const [editedSegment, setEditedSegment] = useState<Segment>({ ...segment });
  const [selectedShotIds, setSelectedShotIds] = useState<Set<string>>(new Set(segment.shotIds));
  const [selectedSceneIds, setSelectedSceneIds] = useState<Set<string>>(new Set(segment.sceneIds));
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<Set<string>>(
    new Set(segment.characterIds),
  );

  if (!isOpen) return null;

  const handleSave = () => {
    const updatedSegment: Segment = {
      ...editedSegment,
      shotIds: Array.from(selectedShotIds),
      sceneIds: Array.from(selectedSceneIds),
      characterIds: Array.from(selectedCharacterIds),
      lastModified: Date.now(),
    };
    onSave(updatedSegment);
  };

  const handleToggleShot = (shotId: string) => {
    const newSelected = new Set(selectedShotIds);
    if (newSelected.has(shotId)) {
      newSelected.delete(shotId);
    } else {
      newSelected.add(shotId);
    }
    setSelectedShotIds(newSelected);

    // Recalculate duration
    const selectedShots = allShots.filter((s) => newSelected.has(s.id));
    const newDuration = selectedShots.reduce(
      (sum, s) => sum + (s.interval?.duration || 2),
      0,
    );
    setEditedSegment({ ...editedSegment, estimatedDuration: newDuration });
  };

  const handleToggleScene = (sceneId: string) => {
    const newSelected = new Set(selectedSceneIds);
    if (newSelected.has(sceneId)) {
      newSelected.delete(sceneId);
    } else {
      newSelected.add(sceneId);
    }
    setSelectedSceneIds(newSelected);
  };

  const handleToggleCharacter = (characterId: string) => {
    const newSelected = new Set(selectedCharacterIds);
    if (newSelected.has(characterId)) {
      newSelected.delete(characterId);
    } else {
      newSelected.add(characterId);
    }
    setSelectedCharacterIds(newSelected);
  };

  const availableShots = allShots.filter((s) => !selectedShotIds.has(s.id));
  const availableScenes = allScenes.filter((s) => !selectedSceneIds.has(s.id));
  const availableCharacters = allCharacters.filter((c) => !selectedCharacterIds.has(c.id));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-700/80 backdrop-blur-sm"
    >
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-[700px] max-w-[90vw] h-[65vh] overflow-hidden shadow-2xl flex flex-col select-text">
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80 shrink-0">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Film className="w-5 h-5 text-slate-400" />
            编辑片段
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-slate-800">
          {/* Duration */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">预估时长</label>
            <div className="flex items-center gap-2">
              <div className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-sm text-slate-50 font-mono">
                {editedSegment.estimatedDuration.toFixed(1)} 秒
              </div>
              <span className="text-xs text-slate-500">
                基于选中的分镜数量自动计算
              </span>
            </div>
          </div>

          {/* Shots */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">
                分镜 ({selectedShotIds.size} / {allShots.length})
              </label>
              {availableShots.length > 0 && (
                <div className="flex-1 pl-6">
                  <CustomSelect
                    value=""
                    onChange={(shotId) => handleToggleShot(shotId)}
                    options={[
                      { value: '', label: '+ 添加分镜' },
                      ...availableShots.map((s) => ({
                        value: s.id,
                        label: `${s.id} ${s.actionSummary.substring(0, 30)}...`,
                      })),
                    ]}
                  />
                </div>
              )}
            </div>
            <div className="border border-slate-600 rounded-lg max-h-48 overflow-y-auto bg-slate-900/50">
              {selectedShotIds.size === 0 ? (
                <div className="p-4 text-center text-sm text-slate-500">
                  未选择任何分镜
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {Array.from(selectedShotIds).map((shotId) => {
                    const shot = allShots.find((s) => s.id === shotId);
                    if (!shot) return null;

                    return (
                      <div
                        key={shotId}
                        className="flex items-center gap-3 p-3 hover:bg-slate-700/50 transition-colors"
                      >
                        <ShotThumbnail shot={shot} isSelected />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-slate-50 truncate">{shot.actionSummary}</p>
                          <p className="text-xs text-slate-500 font-mono">
                            时长: {shot.interval?.duration || 2}s
                          </p>
                        </div>
                        <button
                          onClick={() => handleToggleShot(shotId)}
                          className="p-1.5 hover:bg-red-900/20 text-red-400 rounded transition-colors cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Scenes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">
                场景 ({selectedSceneIds.size} / {allScenes.length})
              </label>
              {availableScenes.length > 0 && (
                <div className="flex-1 pl-6">
                  <CustomSelect
                    value=""
                    onChange={(sceneId) => handleToggleScene(sceneId)}
                    options={[
                      { value: '', label: '+ 添加场景' },
                      ...availableScenes.map((s) => ({
                        value: s.id,
                        label: s.location,
                      })),
                    ]}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {Array.from(selectedSceneIds).map((sceneId) => {
                const scene = getSceneWithAssets
                  ? getSceneWithAssets(sceneId)
                  : allScenes.find((s) => s.id === sceneId);
                if (!scene) return null;

                return (
                  <div
                    key={sceneId}
                    className="relative flex flex-col items-center gap-2 p-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-50 w-[120px]"
                  >
                    <button
                      onClick={() => handleToggleScene(sceneId)}
                      className="absolute top-1 right-1 p-1 hover:bg-red-900/30 hover:text-red-400 rounded transition-colors cursor-pointer z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {scene.referenceImage ? (
                      <img
                        src={scene.referenceImage}
                        alt={scene.location}
                        className="w-full aspect-video object-cover rounded border border-slate-500"
                      />
                    ) : (
                      <div className="w-full aspect-video bg-slate-600 flex items-center justify-center text-2xl rounded border border-slate-500">
                        🏞️
                      </div>
                    )}
                    <span className="text-xs text-center truncate w-full px-1">{scene.location}</span>
                  </div>
                );
              })}
              {selectedSceneIds.size === 0 && (
                <span className="text-sm text-slate-500">未选择任何场景</span>
              )}
            </div>
          </div>

          {/* Characters */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">
                角色 ({selectedCharacterIds.size} / {allCharacters.length})
              </label>
              {availableCharacters.length > 0 && (
                <div className="flex-1 pl-6">
                  <CustomSelect
                    value=""
                    onChange={(charId) => handleToggleCharacter(charId)}
                    options={[
                      { value: '', label: '+ 添加角色' },
                      ...availableCharacters.map((c) => ({
                        value: c.id,
                        label: c.name,
                      })),
                    ]}
                  />
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              {Array.from(selectedCharacterIds).map((charId) => {
                const character = getCharacterWithAssets
                  ? getCharacterWithAssets(charId)
                  : allCharacters.find((c) => c.id === charId);
                if (!character) return null;

                return (
                  <div
                    key={charId}
                    className="relative flex flex-col items-center gap-2 p-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-50 w-[120px]"
                  >
                    <button
                      onClick={() => handleToggleCharacter(charId)}
                      className="absolute top-1 right-1 p-1 hover:bg-red-900/30 hover:text-red-400 rounded transition-colors cursor-pointer z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {character.referenceImage ? (
                      <img
                        src={character.referenceImage}
                        alt={character.name}
                        className="w-full aspect-video object-cover rounded border border-slate-500"
                      />
                    ) : (
                      <div className="w-full aspect-video bg-slate-600 flex items-center justify-center text-2xl rounded border border-slate-500">
                        👤
                      </div>
                    )}
                    <span className="text-xs text-center truncate w-full px-1">{character.name}</span>
                  </div>
                );
              })}
              {selectedCharacterIds.size === 0 && (
                <span className="text-sm text-slate-500">未选择任何角色</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-slate-600/80 border-t border-slate-600 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-600 text-slate-300 hover:bg-slate-800 text-[11px] font-bold tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={selectedShotIds.size === 0}
            className="flex-1 py-3 bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px] font-bold tracking-wider rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default SegmentEditModal;
