import { ChevronDown, Expand, Film, Save, X } from 'lucide-react';
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
  const [characterVariations, setCharacterVariations] = useState<{ [characterId: string]: string }>(
    segment.characterVariations || {},
  );
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    const updatedSegment: Segment = {
      ...editedSegment,
      shotIds: Array.from(selectedShotIds),
      sceneIds: Array.from(selectedSceneIds),
      characterIds: Array.from(selectedCharacterIds),
      characterVariations,
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
      // Also remove variation selection when removing character
      const newVariations = { ...characterVariations };
      delete newVariations[characterId];
      setCharacterVariations(newVariations);
    } else {
      newSelected.add(characterId);
    }
    setSelectedCharacterIds(newSelected);
  };

  const handleSelectVariation = (characterId: string, variationId: string) => {
    setCharacterVariations((prev) => ({
      ...prev,
      [characterId]: variationId,
    }));
  };

  const availableShots = allShots.filter((s) => !selectedShotIds.has(s.id));
  const availableScenes = allScenes.filter((s) => !selectedSceneIds.has(s.id));
  const availableCharacters = allCharacters.filter((c) => !selectedCharacterIds.has(c.id));

  return (
    <div className="fixed inset-0 z-60 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200 select-text">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-[700px] max-w-[90vw] h-[85vh] overflow-hidden shadow-2xl flex flex-col select-text">
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
                let scene = allScenes.find((c) => c.id === sceneId);
                if(!scene && getSceneWithAssets){
                  scene = getSceneWithAssets(sceneId);
                }
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
                      <div
                        className="relative w-full aspect-video rounded border border-slate-500 overflow-hidden cursor-pointer group"
                        onClick={() => setPreviewImage(scene.referenceImage!)}
                      >
                        <img
                          src={scene.referenceImage}
                          alt={scene.location}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-slate-700/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Expand className="w-5 h-5 text-slate-50" />
                        </div>
                      </div>
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
                let character = allCharacters.find((c) => c.id === charId);
                if(!character && getCharacterWithAssets){
                  character = getCharacterWithAssets(charId);
                }
                if (!character) return null;

                // Get available variations (base + variations with images)
                const availableLooks: { id: string; name: string; image: string }[] = [];
                if (character.referenceImage) {
                  availableLooks.push({ id: 'base', name: '默认造型', image: character.referenceImage });
                }
                character.variations?.forEach((v) => {
                  if (v.referenceImage) {
                    availableLooks.push({ id: v.id, name: v.name, image: v.referenceImage });
                  }
                });

                // Get current selected look
                const selectedVariationId = characterVariations[charId];
                const currentLook = selectedVariationId
                  ? availableLooks.find((l) => l.id === selectedVariationId) || availableLooks[0]
                  : availableLooks[0];

                return (
                  <div
                    key={charId}
                    className="relative flex flex-col items-center gap-2 p-2 bg-slate-700 border border-slate-600 rounded-lg text-sm text-slate-50 w-[140px]"
                  >
                    <button
                      onClick={() => handleToggleCharacter(charId)}
                      className="absolute top-1 right-1 p-1 hover:bg-red-900/30 hover:text-red-400 rounded transition-colors cursor-pointer z-10"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    {currentLook?.image ? (
                      <div
                        className="relative w-full aspect-video rounded border border-slate-500 overflow-hidden cursor-pointer group"
                        onClick={() => setPreviewImage(currentLook.image)}
                      >
                        <img
                          src={currentLook.image}
                          alt={character.name}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-slate-700/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Expand className="w-5 h-5 text-slate-50" />
                        </div>
                      </div>
                    ) : (
                      <div className="w-full aspect-video bg-slate-600 flex items-center justify-center text-2xl rounded border border-slate-500">
                        👤
                      </div>
                    )}
                    <span className="text-xs text-center truncate w-full px-1">{character.name}</span>
                    {/* Variation Selector */}
                    {availableLooks.length > 1 && (
                      <div className="w-full relative">
                        <select
                          value={currentLook?.id || 'base'}
                          onChange={(e) => handleSelectVariation(charId, e.target.value)}
                          className="w-full px-2 py-1 text-[10px] bg-slate-800 border border-slate-600 rounded text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer appearance-none"
                        >
                          {availableLooks.map((look) => (
                            <option key={look.id} value={look.id}>
                              {look.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 pointer-events-none" />
                      </div>
                    )}
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
            className="flex-1 py-3 bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px] font-bold tracking-wider rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            保存
          </button>
        </div>
      </div>

      {/* Fullscreen Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          <button
            onClick={() => setPreviewImage(null)}
            className="absolute top-6 right-6 p-3 bg-slate-900/80 hover:bg-slate-800 text-slate-50 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewImage}
            alt="Full screen preview"
            className="max-w-[95vw] max-h-[95vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default SegmentEditModal;
