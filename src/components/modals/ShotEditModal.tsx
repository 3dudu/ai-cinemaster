import { Aperture, Check, Plus, RefreshCw, Trash, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { modelConfigEventBus } from '../../services/modelConfigEvents';
import { getAllModelConfigs } from '../../services/storageService';
import { AIModelConfig, Keyframe, Props, Shot } from '../../types';
import CustomSelect from '../common/CustomSelect';
import VideoPromptModal from './VideoPromptModal';

const ShotEditModal: React.FC<Props> = ({ shot, characters, onSave, onClose, imageCount, scriptData, visualStyle = '真人写实' }) => {
  const [tempShot, setTempShot] = useState<Partial<Shot>>({ ...shot });
  const [modelConfigs, setModelConfigs] = useState<AIModelConfig[]>([]);
  const [isVideoPromptModalOpen, setIsVideoPromptModalOpen] = useState(false);
  const isNewShot = !shot.id;

  useEffect(() => {
    const loadModelConfigs = async () => {
      try {
        const configs = await getAllModelConfigs();
        setModelConfigs(configs);
      } catch (error) {
        console.error('加载模型配置失败:', error);
      }
    };
    loadModelConfigs();
  }, []);

  // 监听模型配置变更事件
  useEffect(() => {
    const unsubscribe = modelConfigEventBus.subscribe(async () => {
      try {
        const configs = await getAllModelConfigs();
        setModelConfigs(configs);
        ////console.log('模型配置已自动刷新');
      } catch (error) {
        console.error('自动刷新模型配置失败:', error);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const toggleCharacter = (charId: string) => {
    const currentChars = tempShot.characters || [];
    const updatedChars = currentChars.includes(charId)
      ? currentChars.filter((c: string) => c !== charId)
      : [...currentChars, charId];
    setTempShot({ ...tempShot, characters: updatedChars });
  };

  const getAvailableKeyframeType = (): 'start' | 'end' | 'full' | null => {
    const keyframes = tempShot.keyframes || [];
    const hasStart = keyframes.some(kf => kf.type === 'start');
    const hasEnd = keyframes.some(kf => kf.type === 'end');
    const hasFull = keyframes.some(kf => kf.type === 'full');

    // If 'full' exists, cannot add more
    if (hasFull) return null;
    // If 'start' exists, can only add 'end' (to complete start+end pair)
    if (hasStart) return 'end';
    // If 'end' exists without 'start', can add 'start'
    if (hasEnd) return 'start';
    // If none exist, can add 'start' or 'full' (default to 'start')
    return 'start';
  };

  const getAvailableKeyframeOptions = () => {
    const keyframes = tempShot.keyframes || [];
    const hasStart = keyframes.some(kf => kf.type === 'start');
    const hasEnd = keyframes.some(kf => kf.type === 'end');
    const hasFull = keyframes.some(kf => kf.type === 'full');

    // If any frame exists, show all options but disable invalid ones
    if (hasStart || hasEnd || hasFull) {
      return [
        { value: 'start', label: '起始帧', disabled: hasEnd },
        { value: 'end', label: '结束帧', disabled: !hasStart || hasEnd },
        { value: 'full', label: '连环画', disabled: true }
      ];
    }

    // Initial state: can choose start or full
    return [
      { value: 'start', label: '起始帧' },
      { value: 'end', label: '结束帧', disabled: true },
      { value: 'full', label: '连环画' }
    ];
  };

  const canAddKeyframe = (): boolean => {
    return getAvailableKeyframeType() !== null;
  };

  const addKeyframe = () => {
    const availableType = getAvailableKeyframeType();
    if (!availableType) return;

    const newKeyframe: Keyframe = {
      id: `kf-${Date.now()}`,
      type: availableType,
      visualPrompt: '',
      status: 'pending'
    };
    setTempShot({
      ...tempShot,
      keyframes: [...(tempShot.keyframes || []), newKeyframe]
    });
  };

  const updateKeyframe = (kfIndex: number, field: string, value: any) => {
    const updatedKeyframes = [...(tempShot.keyframes || [])];
    updatedKeyframes[kfIndex] = { ...updatedKeyframes[kfIndex], [field]: value };
    setTempShot({ ...tempShot, keyframes: updatedKeyframes });
  };

  const deleteKeyframe = (kfIndex: number) => {
    const updatedKeyframes = (tempShot.keyframes || []).filter((_: any, i: number) => i !== kfIndex);
    setTempShot({ ...tempShot, keyframes: updatedKeyframes });
  };

  const handleSave = () => {
    onSave(tempShot);
  };

  return (
    <div className="absolute inset-0 z-50 bg-slate-700/90 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
      <div className="bg-slate-800 border border-slate-600 rounded-2xl w-[600px] max-w-[90vw] h-[85vh] overflow-hidden shadow-2xl flex flex-col select-text">
        <div className="h-16 px-6 border-b border-slate-600 flex items-center justify-between bg-slate-600/80">
          <h3 className="text-lg font-bold text-slate-50 flex items-center gap-2">
            <Aperture className="w-5 h-5 text-slate-400" />
            {isNewShot ? '添加分镜' : '编辑分镜'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 bg-slate-700 hover:bg-slate-800 rounded-full text-slate-500 hover:text-slate-50 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 md:p-6 space-y-5 bg-slate-700">
          {/* Action Summary */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">动作描述</label>
            <textarea
              value={tempShot.actionSummary || ''}
              onChange={(e) => setTempShot({ ...tempShot, actionSummary: e.target.value })}
              className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all resize-none"
              rows={2}
              placeholder="描述镜头中的动作..."
            />
          </div>

          {/* Dialogue */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">对白 (可选)</label>
            <div className="space-y-2">
              {tempShot.dialogue && tempShot.dialogue instanceof Array && (tempShot.dialogue || []).map((dlg, index) => (
                <div key={index} className="flex gap-1 items-start">
                  <CustomSelect
                    className="w-[140px]"
                    options={[
                      ...characters.map(char => ({ value: char.name, label: char.name }))
                    ]}
                    value={dlg.character || ''}
                    onChange={(value) => {
                      const updatedDialogue = [...(tempShot.dialogue || [])];
                      updatedDialogue[index] = { ...updatedDialogue[index], character: value };
                      setTempShot({ ...tempShot, dialogue: updatedDialogue });
                    }}
                    placeholder="选择角色"
                  />
                  <input
                    type="text"
                    value={dlg.value || ''}
                    onChange={(e) => {
                      const updatedDialogue = [...(tempShot.dialogue || [])];
                      updatedDialogue[index] = { ...updatedDialogue[index], value: e.target.value };
                      setTempShot({ ...tempShot, dialogue: updatedDialogue });
                    }}
                    className="flex-1 bg-slate-800 border border-slate-600 text-slate-50 px-4 py-2 text-sm rounded-md focus:border-slate-500 focus:outline-none transition-all"
                    placeholder="输入对话内容..."
                  />
                  <button
                    onClick={() => {
                      const updatedDialogue = (tempShot.dialogue || []).filter((_: any, i: number) => i !== index);
                      setTempShot({ ...tempShot, dialogue: updatedDialogue });
                    }}
                    className="p-2.5 hover:bg-red-900/20 text-red-400 group-hover:text-red-600 rounded transition-colors shrink-0 cursor-pointer"
                    title="删除对话"
                  >
                    <Trash className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => {
                  const newDialogue = { character: '', value: '' };
                  setTempShot({ ...tempShot, dialogue: [...(tempShot.dialogue && tempShot.dialogue instanceof Array ? tempShot.dialogue : []), newDialogue] });
                }}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-50 bg-slate-900 border border-slate-600 rounded hover:border-slate-300 transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                添加对话
              </button>
            </div>
          </div>

          {/* Shot Size & Camera Movement & Duration */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">景别</label>
              <CustomSelect
                options={[
                  { value: '特写', label: '特写' },
                  { value: '大特写', label: '大特写' },
                  { value: '中近景', label: '中近景' },
                  { value: '中景', label: '中景' },
                  { value: '中远景', label: '中远景' },
                  { value: '远景', label: '远景' },
                  { value: '全景', label: '全景' }
                ]}
                value={tempShot.shotSize || '特写'}
                onChange={(value) => setTempShot({ ...tempShot, shotSize: value })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">镜头运动</label>
              <CustomSelect
                options={[
                  { value: '固定', label: '固定' },
                  { value: '前推', label: '前推' },
                  { value: '后拉', label: '后拉' },
                  { value: '左摇', label: '左摇' },
                  { value: '右摇', label: '右摇' },
                  { value: '上移', label: '上移' },
                  { value: '下移', label: '下移' },
                  { value: '跟随', label: '跟随' },
                  { value: '手持', label: '手持' }
                ]}
                value={tempShot.cameraMovement || '固定'}
                onChange={(value) => setTempShot({ ...tempShot, cameraMovement: value })}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">时长 (秒)</label>
              <CustomSelect
                options={Array.from({ length: 30 }, (_, i) => i + 1).map(sec => ({
                  value: sec.toString(),
                  label: `${sec} 秒`
                }))}
                value={tempShot.interval?.duration?.toString() || '5'}
                onChange={(value) => setTempShot({ ...tempShot, interval: { ...tempShot.interval, duration: Number(value) } as any })}
                className="w-full"
              />
            </div>
          </div>

          {/* Video Prompt */}
          {shot.interval && (
            <div className="space-y-2">
              <div className="text-[12px] font-bold text-slate-500 tracking-widest flex items-center justify-between">
                <span className='flex-1'>视频拍摄提示词</span>
                <button
                  onClick={() => setIsVideoPromptModalOpen(true)}
                  className="text-[11px] text-slate-400 hover:text-slate-50 transition-colors cursor-pointer"
                >
                  编辑提示词
                </button>
              </div>
              <div
                className={`p-3 rounded-md border text-xs ${
                  shot.interval.videoPrompt
                    ? 'bg-slate-800/50 border-slate-600 text-slate-300'
                    : 'bg-slate-900/30 border-slate-700 text-slate-500 italic'
                }`}
              >
                {shot.interval.videoPrompt || '暂无提示词，点击"编辑提示词"按钮生成'}
              </div>
            </div>
          )}

          {/* Characters */}
          <div className="space-y-2">
            <label className="text-[12px] font-bold text-slate-500 tracking-widest">角色</label>
            <div className="flex flex-wrap gap-2">
              {characters.map(char => {
                const isSelected = (tempShot.characters || []).includes(char.id);
                const hasImage = !!char.referenceImage;
                return (
                  <button
                    key={char.id}
                    onClick={() => toggleCharacter(char.id)}
                    className={`relative px-3 py-2 text-xs font-medium rounded-md transition-all duration-200 border flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-slate-600 text-slate-50 border-slate-500 shadow-lg shadow-slate-500/25 scale-100'
                        : 'bg-slate-900 text-slate-400 border-slate-600 hover:border-slate-300 hover:text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {/* 头像 */}
                    {hasImage && (
                      <div className={`w-5 h-5 rounded-full overflow-hidden flex-shrink-0 ${
                        isSelected ? 'ring-2 ring-white/30' : 'opacity-70'
                      }`}>
                        <img
                          src={char.referenceImage}
                          alt={char.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    {/* 对勾图标 - 如果没有头像则显示，如果有头像则显示在右侧 */}
                    {isSelected && !hasImage && <Check className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={3} />}
                    {/* 角色名 */}
                    <span className="truncate">{char.name}</span>
                    {/* 选中且有头像时的对勾 */}
                    {isSelected && hasImage && <Check className="w-3.5 h-3.5 flex-shrink-0" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
            {(tempShot.characters || []).length > 0 && (
              <div className="text-[11px] text-slate-500">
                已选择 {tempShot.characters?.length} 个角色
              </div>
            )}
          </div>

          {/* Keyframes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-bold text-slate-500 tracking-widest">关键帧</label>
              <button
                onClick={addKeyframe}
                disabled={!canAddKeyframe()}
                className={`text-xs font-bold flex items-center gap-1 px-3 py-1.5 border rounded transition-all cursor-pointer ${
                  canAddKeyframe()
                    ? 'text-slate-400 hover:text-slate-50 bg-slate-900 border-slate-600 hover:border-slate-300'
                    : 'text-slate-600 bg-slate-800/50 border-slate-700 cursor-not-allowed'
                }`}
              >
                <Plus className="w-3 h-3" />
                添加关键帧
              </button>
            </div>

            <div className="space-y-3">
              {(tempShot.keyframes || []).map((kf: Keyframe, kfIdx: number) => (
                <div key={kf.id || kfIdx} className="bg-slate-800 border border-slate-600 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex gap-2">
                      <CustomSelect
                        options={getAvailableKeyframeOptions()}
                        value={kf.type || 'start'}
                        onChange={(value) => updateKeyframe(kfIdx, 'type', value)}
                        size="sm"
                      />
                    </div>
                    <button
                      onClick={() => deleteKeyframe(kfIdx)}
                      className="p-1.5 hover:bg-red-900/20 text-red-400 group-hover:text-red-600 rounded transition-colors cursor-pointer"
                      title="删除关键帧"
                    >
                      <Trash className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-500 tracking-widest mb-1 block">画面提示词</label>
                    <textarea
                      value={kf.visualPrompt || ''}
                      onChange={(e) => updateKeyframe(kfIdx, 'visualPrompt', e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 text-slate-50 px-3 py-2 text-xs rounded-md focus:border-slate-500 focus:outline-none transition-all resize-none font-mono"
                      rows={3}
                      placeholder="输入视觉提示词，用于 AI 生成图像..."
                    />
                  </div>
                </div>
              ))}
            </div>

            {(tempShot.keyframes || []).length === 0 && (
              <div className="text-center py-8 border border-dashed border-slate-600 rounded-lg">
                <Aperture className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-xs text-slate-500">暂无关键帧，点击上方按钮添加</p>
              </div>
            )}
          </div>

          {/* Model Providers */}
          <div className="space-y-4 border-t border-slate-600 pt-4">
            <div className="flex items-center justify-between">
              <div className="text-[12px] font-bold text-slate-500 tracking-widest">模型供应商</div>
              <button
                onClick={async () => {
                  try {
                    const configs = await getAllModelConfigs();
                    setModelConfigs(configs);
                    //console.log('模型配置已刷新');
                  } catch (error) {
                    console.error('刷新模型配置失败:', error);
                  }
                }}
                className="text-[11px] text-slate-400 hover:text-slate-50 transition-colors flex items-center gap-1 cursor-pointer"
                title="刷新模型配置"
              >
                <RefreshCw className="w-3 h-3" />
                <span>刷新</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Text2Image Provider */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 tracking-widest">图像模型</label>
                <CustomSelect
                  options={[
                    { value: '', label: '使用项目默认' },
                    ...modelConfigs.filter(c => c.modelType === 'text2image' && c.apiKey).map(config => ({
                      value: config.id,
                      label: `${config.provider} - ${config.model || config.description}`
                    }))
                  ]}
                  value={tempShot.modelProviders?.text2image || ''}
                  onChange={(value) => setTempShot({ ...tempShot, modelProviders: { ...tempShot.modelProviders, text2image: value || undefined } })}
                  placeholder="使用项目默认"
                  dropdownPosition="top"
                />
              </div>

              {/* Image2Video Provider */}
              <div className="space-y-2">
                <label className="text-[11px] font-bold text-slate-500 tracking-widest">视频模型</label>
                <CustomSelect
                  options={[
                    { value: '', label: '使用项目默认' },
                    ...modelConfigs.filter(c => c.modelType === 'image2video' && c.apiKey).map(config => ({
                      value: config.id,
                      label: `${config.provider} - ${config.model || config.description}`
                    }))
                  ]}
                  value={tempShot.modelProviders?.image2video || ''}
                  onChange={(value) => setTempShot({ ...tempShot, modelProviders: { ...tempShot.modelProviders, image2video: value || undefined } })}
                  placeholder="使用项目默认"
                  dropdownPosition="top"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-600/80 border-t border-slate-600 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-slate-600 text-slate-300 hover:bg-slate-800 text-[11px] font-bold tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-3 bg-slate-800 text-slate-300 hover:bg-slate-700 text-[11px] font-bold tracking-wider rounded-lg transition-colors cursor-pointer"
          >
            保存
          </button>
        </div>
      </div>

      {/* Video Prompt Modal */}
      <VideoPromptModal
        isOpen={isVideoPromptModalOpen}
        onClose={() => setIsVideoPromptModalOpen(false)}
        shot={shot}
        scriptData={scriptData}
        visualStyle={visualStyle}
        onSave={(videoPrompt) => {
          onSave({
            ...shot,
            interval: shot.interval ? { ...shot.interval, videoPrompt } : undefined
          });
        }}
      />
    </div>
  );
};

export default ShotEditModal;
