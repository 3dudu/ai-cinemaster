import { ModelService } from '../services/modelService';
import { renderTemplate } from "../services/promptTemplates";
import { Character, Scene, Segment, Shot } from '../types';

/**
 * 将分镜数组转换为片段数组
 * 规则：每个片段时长不超过15秒，尽量贴近15秒
 * 同一场景、同一角色序列尽量合并到一个片段
 */
export function convertShotsToSegments(shots: Shot[]): Segment[] {
  if (!shots || shots.length === 0) {
    return [];
  }

  const segments: Segment[] = [];
  let currentSegmentShotIds: string[] = [];
  let currentDuration = 0;
  let segmentIndex = 0;

  for (const shot of shots) {
    const shotDuration = shot.interval?.duration || 2; // 默认2秒

    // 如果添加此分镜会超过15秒，且已有分镜，则创建新片段
    if (currentDuration + shotDuration > 15 && currentSegmentShotIds.length > 0) {
      // 创建当前片段
      segments.push(createSegmentFromShots(
        currentSegmentShotIds,
        shots.filter(s => currentSegmentShotIds.includes(s.id)),
        segmentIndex++
      ));
      currentSegmentShotIds = [];
      currentDuration = 0;
    }

    currentSegmentShotIds.push(shot.id);
    currentDuration += shotDuration;
  }

  // 处理最后一个片段
  if (currentSegmentShotIds.length > 0) {
    segments.push(createSegmentFromShots(
      currentSegmentShotIds,
      shots.filter(s => currentSegmentShotIds.includes(s.id)),
      segmentIndex
    ));
  }

  return segments;
}

/**
 * 从分镜列表创建片段
 */
function createSegmentFromShots(shotIds: string[], shots: Shot[], index: number): Segment {
  // 提取涉及的场景和角色（去重）
  const sceneIds = [...new Set(shots.map(s => s.sceneId))];
  const characterIds = [...new Set(shots.flatMap(s => s.characters))];

  // 计算总时长
  const estimatedDuration = shots.reduce(
    (sum, s) => sum + (s.interval?.duration || 2),
    0
  );

  return {
    id: `segment-${Date.now()}-${index}`,
    shotIds,
    sceneIds,
    characterIds,
    description: '', // 待LLM生成
    transitionFrom: '',
    transitionTo: '',
    estimatedDuration,
    createdAt: Date.now(),
    lastModified: Date.now(),
  };
}

/**
 * 生成分片描述
 */
export async function generateSegmentDescription(
  segment: Segment,
  allShots: Shot[],
  characters: Character[],
  scenes: Scene[],
  visualstyle: string,
  genre: string,
): Promise<string> {
  const segmentShots = allShots.filter(s => segment.shotIds.includes(s.id));

  // 构建提示词
  const shotDescriptions = segmentShots.map((shot, idx) => {
    const scene = scenes.find(s => s.id === shot.sceneId);
    const shotChars = shot.characters.map(cid =>
      characters.find(c => c.id === cid)?.name || cid
    ).join('、');

    return `分镜${idx + 1}：${shot.actionSummary} 场景：${scene?.location || '未知'} 角色：${shotChars}。`;
  }).join('\n');

  const prompt = renderTemplate('GENERATE_SEGMENT_PROMPT', shotDescriptions, visualstyle, genre);

  try {
    const sysctemPrompt=renderTemplate('SYSTEM_SEGMENT_DESIGNER');

    const response = await ModelService.generateSegmentPropmt(prompt,sysctemPrompt);
    return response || '';
  } catch (error) {
    console.error('生成片段描述失败:', error);
    return '';
  }
}

/**
 * 生成转场描述
 */
export async function generateTransitionDescription(
  fromSegment: Segment,
  toSegment: Segment,
  fromDescription: string,
  toDescription: string
): Promise<string> {
  const prompt = `请根据以下两个片段的描述，生成一个自然的转场描述：

片段A：${fromDescription}

片段B：${toDescription}

要求：
1. 描述如何从片段A过渡到片段B
2. 可以是镜头移动、时间流逝、视角切换等
3. 控制在20-50字之间
4. 简洁明了，富有画面感`;
    const sysctemPrompt=renderTemplate('SYSTEM_SEGMENT_TRANSLATE');

  try {
    const response = await ModelService.generateSegmentPropmt(prompt,sysctemPrompt);
    return response || '';
  } catch (error) {
    console.error('生成转场描述失败:', error);
    return '';
  }
}

/**
 * 批量生成所有片段描述
 */
export async function generateAllSegmentDescriptions(
  segments: Segment[],
  allShots: Shot[],
  characters: Character[],
  scenes: Scene[],
  visualstyle:string,
  genre:string,
): Promise<Segment[]> {
  const updatedSegments = [...segments];

  for (let i = 0; i < updatedSegments.length; i++) {
    const description = await generateSegmentDescription(
      updatedSegments[i],
      allShots,
      characters,
      scenes,
      visualstyle,
      genre
    );
    updatedSegments[i] = {
      ...updatedSegments[i],
      description,
      lastModified: Date.now(),
    };
  }

  return updatedSegments;
}

/**
 * 批量生成所有转场描述
 */
export async function generateAllTransitionDescriptions(
  segments: Segment[]
): Promise<Segment[]> {
  if (segments.length < 2) {
    return segments;
  }

  const updatedSegments = [...segments];

  for (let i = 0; i < updatedSegments.length; i++) {
    // 生成当前片段的transitionTo（指向下一个片段）
    if (i < updatedSegments.length - 1) {
      const toDescription = await generateTransitionDescription(
        updatedSegments[i],
        updatedSegments[i + 1],
        updatedSegments[i].description,
        updatedSegments[i + 1].description
      );
      updatedSegments[i] = {
        ...updatedSegments[i],
        transitionTo: toDescription,
        lastModified: Date.now(),
      };
    }

    // 生成当前片段的transitionFrom（来自上一个片段）
    if (i > 0) {
      updatedSegments[i] = {
        ...updatedSegments[i],
        transitionFrom: updatedSegments[i - 1].transitionTo,
        lastModified: Date.now(),
      };
    }
  }

  return updatedSegments;
}

/**
 * 合并相邻的片段
 */
export function mergeSegments(
  segments: Segment[],
  mergeFromIndex: number,
  mergeToIndex: number
): Segment[] {
  if (Math.abs(mergeFromIndex - mergeToIndex) !== 1) {
    console.warn('只能合并相邻的片段');
    return segments;
  }

  const [firstIdx, secondIdx] = mergeFromIndex < mergeToIndex
    ? [mergeFromIndex, mergeToIndex]
    : [mergeToIndex, mergeFromIndex];

  const segment1 = segments[firstIdx];
  const segment2 = segments[secondIdx];

  const mergedSegment: Segment = {
    id: `segment-${Date.now()}-merged`,
    shotIds: [...segment1.shotIds, ...segment2.shotIds],
    sceneIds: [...new Set([...segment1.sceneIds, ...segment2.sceneIds])],
    characterIds: [...new Set([...segment1.characterIds, ...segment2.characterIds])],
    description: '', // 重新生成
    transitionFrom: segment1.transitionFrom,
    transitionTo: segment2.transitionTo,
    estimatedDuration: segment1.estimatedDuration + segment2.estimatedDuration,
    createdAt: Math.min(segment1.createdAt, segment2.createdAt),
    lastModified: Date.now(),
  };

  const newSegments = [...segments];
  newSegments.splice(firstIdx, 2, mergedSegment);

  return newSegments;
}

/**
 * 拆分片段
 */
export function splitSegment(
  segment: Segment,
  shotIdToSplitAfter: string
): Segment[] {
  const splitIndex = segment.shotIds.indexOf(shotIdToSplitAfter);

  if (splitIndex === -1 || splitIndex === segment.shotIds.length - 1) {
    console.warn('无法在指定位置拆分片段');
    return [segment];
  }

  const firstHalfShotIds = segment.shotIds.slice(0, splitIndex + 1);
  const secondHalfShotIds = segment.shotIds.slice(splitIndex + 1);

  const segment1: Segment = {
    ...segment,
    id: `${segment.id}-part1`,
    shotIds: firstHalfShotIds,
    estimatedDuration: segment.estimatedDuration / 2, // 简化处理
    lastModified: Date.now(),
  };

  const segment2: Segment = {
    ...segment,
    id: `${segment.id}-part2`,
    shotIds: secondHalfShotIds,
    description: '',
    transitionFrom: segment1.transitionTo,
    transitionTo: segment.transitionTo,
    estimatedDuration: segment.estimatedDuration / 2,
    createdAt: Date.now(),
    lastModified: Date.now(),
  };

  return [segment1, segment2];
}

/**
 * 删除片段中的分镜
 */
export function removeShotsFromSegment(
  segment: Segment,
  shotIdsToRemove: string[]
): Segment | null {
  const remainingShotIds = segment.shotIds.filter(id => !shotIdsToRemove.includes(id));

  if (remainingShotIds.length === 0) {
    return null; // 片段被清空，返回null表示需要删除片段
  }

  return {
    ...segment,
    shotIds: remainingShotIds,
    lastModified: Date.now(),
  };
}

/**
 * 向片段添加分镜
 */
export function addShotsToSegment(
  segment: Segment,
  shotIdsToAdd: string[],
  allShots: Shot[]
): Segment {
  const shotsToAdd = allShots.filter(s => shotIdsToAdd.includes(s.id));

  // 计算新增分镜的总时长
  const addedDuration = shotsToAdd.reduce(
    (sum, s) => sum + (s.interval?.duration || 2),
    0
  );

  return {
    ...segment,
    shotIds: [...new Set([...segment.shotIds, ...shotIdsToAdd])],
    sceneIds: [...new Set([
      ...segment.sceneIds,
      ...shotsToAdd.map(s => s.sceneId),
    ])],
    characterIds: [...new Set([
      ...segment.characterIds,
      ...shotsToAdd.flatMap(s => s.characters),
    ])],
    estimatedDuration: segment.estimatedDuration + addedDuration,
    lastModified: Date.now(),
  };
}

/**
 * AI 智能拆分片段
 * 将分镜数据发送给 LLM，由大模型决定如何拆分
 * @returns 拆分后的片段数组，失败返回 null
 */
export async function aiConvertShotsToSegments(
  shots: Shot[],
  characters: Character[],
  scenes: Scene[],
  visualStyle: string = "真人写实",
  genre: string = "剧情片"
): Promise<Segment[] | null> {
  if (!shots || shots.length === 0) {
    return [];
  }

  // 1. 简化 shots 数据（去除大体积字段）
  const simplifiedShots = shots.map(shot => ({
    id: shot.id,
    sceneId: shot.sceneId,
    actionSummary: shot.actionSummary,
    dialogue: shot.dialogue,
    cameraMovement: shot.cameraMovement,
    shotSize: shot.shotSize,
    characters: shot.characters,
    interval: shot.interval ? { duration: shot.interval.duration } : undefined,
  }));

  // 2. 构建角色映射（id: name）
  const charactersMap = characters.map(c => `${c.id}: ${c.name}`).join('\n');

  // 3. 构建场景映射（id: location）
  const scenesMap = scenes.map(s => `${s.id}: ${s.location}`).join('\n');

  // 4. 构建 prompt
  const prompt = renderTemplate(
    'AI_SPLIT_SEGMENTS',
    JSON.stringify(simplifiedShots, null, 2),
    charactersMap,
    scenesMap,
    visualStyle,
    genre
  );

  try {
    const sysctemPrompt=renderTemplate('SYSTEM_SEGMENT_SPLIT');

    // 5. 调用 LLM
    const response = await ModelService.generateSegmentPropmt(prompt,sysctemPrompt);

    // 6. 解析响应（失败返回 null）
    return parseAiSegmentResponse(response, shots);

  } catch (error) {
    console.error('AI 拆分片段失败:', error);
    return null;
  }
}

/**
 * 解析 AI 返回的片段拆分结果
 * @returns 有效的片段数组，失败返回 null
 */
function parseAiSegmentResponse(response: string, originalShots: Shot[]): Segment[] | null {
  try {
    // 提取 JSON 部分
    let jsonStr = response;
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    console.log('jsonStr', jsonStr);
    const parsed = JSON.parse(jsonStr);

    if (!parsed.segments || !Array.isArray(parsed.segments)) {
      console.warn('AI 响应缺少 segments 数组');
      return null;
    }

    // 验证并构建 Segment 对象
    const segments: Segment[] = [];
    const assignedShotIds = new Set<string>();
    const validShotIds = new Set(originalShots.map(s => s.id));

    for (let i = 0; i < parsed.segments.length; i++) {
      const seg = parsed.segments[i];

      // 验证 shotIds
      if (!seg.shotIds || !Array.isArray(seg.shotIds)) {
        continue;
      }

      const validShotIdsForSeg = seg.shotIds.filter((id: string) => {
        if (!validShotIds.has(id) || assignedShotIds.has(id)) {
          return false;
        }
        assignedShotIds.add(id);
        return true;
      });

      if (validShotIdsForSeg.length === 0) {
        continue;
      }

      // 获取该片段的分镜数据
      const segShots = originalShots.filter(s => validShotIdsForSeg.includes(s.id));

      // 计算场景 IDs 和角色 IDs
      const sceneIds = [...new Set(segShots.map(s => s.sceneId))];
      const characterIds = [...new Set(segShots.flatMap(s => s.characters))];

      // 计算预估时长
      const calculatedDuration = segShots.reduce(
        (sum, s) => sum + (s.interval?.duration || 2),
        0
      );

      // 构建 Segment
      segments.push({
        id: `segment-${Date.now()}-${i}`,
        shotIds: validShotIdsForSeg,
        sceneIds,
        characterIds,
        description: seg.description || '',
        transitionFrom: '',
        transitionTo: '',
        estimatedDuration: seg.estimatedDuration || calculatedDuration,
        createdAt: Date.now(),
        lastModified: Date.now(),
      });
    }

    // 检查是否所有分镜都被分配
    const unassignedShots = originalShots.filter(s => !assignedShotIds.has(s.id));
    if (unassignedShots.length > 0) {
      // 将未分配的分镜添加到最后一个片段
      if (segments.length > 0) {
        const lastSegment = segments[segments.length - 1];
        lastSegment.shotIds.push(...unassignedShots.map(s => s.id));
        lastSegment.sceneIds = [...new Set([
          ...lastSegment.sceneIds,
          ...unassignedShots.map(s => s.sceneId)
        ])];
        lastSegment.characterIds = [...new Set([
          ...lastSegment.characterIds,
          ...unassignedShots.flatMap(s => s.characters)
        ])];
        // 重新计算时长
        const allSegShots = originalShots.filter(s => lastSegment.shotIds.includes(s.id));
        lastSegment.estimatedDuration = allSegShots.reduce(
          (sum, s) => sum + (s.interval?.duration || 2),
          0
        );
      } else {
        // 如果没有有效片段，返回 null
        console.warn('AI 拆分没有产生有效片段');
        return null;
      }
    }

    return segments.length > 0 ? segments : null;

  } catch (error) {
    console.error('解析 AI 片段响应失败:', error);
    return null;
  }
}
