# StageImage.tsx 代码审查报告

基于 **Vercel React Best Practices** 的性能审查

---

## 🔴 CRITICAL 问题

### 1. Helper 函数未缓存 - `rerender-derived-state`

#### ❌ 问题描述
`getCharacterWithAssets` 和 `getSceneWithAssets` 在每次渲染时都重新创建。

```typescript
// 第 149-174 行
const getCharacterWithAssets = (char: import('../types').Character, projectSeriesRefId?: string): import('../types').Character => {
  if (!projectSeriesRefId || !char.refId) return char;
  
  const series = seriesList.find(s => s.id === projectSeriesRefId); // ⚠️ 每次数组查找
  if (series?.library?.characters) {
    const libraryChar = series.library.characters.find(c => c.id === char.refId);
    if (libraryChar) return libraryChar;
  }
  return char;
};

const getSceneWithAssets = (scene: import('../types').Scene, projectSeriesRefId?: string): import('../types').Scene => {
  // 同样的问题
};
```

**影响**: 
- ⚠️ 函数引用在每次渲染时都会变化
- ⚠️ 如果在 JSX 中使用，会导致子组件不必要的重渲染
- ⚠️ 数组查找操作每次都执行

---

### 2. findPormtFromHistory 函数未缓存

#### ❌ 问题描述
```typescript
// 第 140-146 行
const findPormtFromHistory = (historyFiles: MediaFile[],fileid: string) => {
    const file = historyFiles.find(f => f.id === fileid);
    if (file) {
      return file;
    }
    return {prompt: '',timestamp: 0};
}
```

**影响**: 每次渲染都创建新函数引用

---

### 3. 事件处理函数未缓存 - `rerender-functional-setstate`

#### ❌ 问题描述
所有事件处理函数都没有使用 `useCallback` 缓存。

```typescript
// 第 86-136 行
const handleDownloadImage = async (imageUrl: string, charName: string) => {
  if(downloadStatus)return;
  setDownloadStatus('downloading');
  try{
    await downloadImage(imageUrl, `${charName}.png`, null);
  }finally{
    setDownloadStatus(null);
  }
};

const handleDownloadVideo = async (imageUrl: string, charName: string) => {
  // 同样的问题
};

const handleDeleteHistory = async (image: ImageItem, e: React.MouseEvent) => {
  e.stopPropagation();
  if (!image.ishistory) return;
  try {
    const confirmed = await dialog.confirm({ /* ... */ });
    if (!confirmed) return;
    setAllImages(prevImages => prevImages.filter(img => img.id !== image.id));
    await deleteSingleMediaFile(image.projectId, image.id);
  } catch (error) {
    console.error('Failed to delete media history:', error);
  }
};

const handleShowPrompt = (image: ImageItem, e: React.MouseEvent) => {
  e.stopPropagation();
  if (image.prompt) {
    setSelectedPrompt({ title: image.title, prompt: image.prompt, timestamp: image.timestamp });
    setShowPromptModal(true);
  }
};
```

**影响**: 
- ⚠️ 传递给子组件的函数引用不稳定
- ⚠️ 导致子组件因 props 变化而重渲染

---

### 4. 水母流加载 - `async-waterfall`

#### ❌ 问题描述
在 `loadAllImages` 函数中，MD5 计算以串行方式执行。

```typescript
// 第 196-378 行
for (const episodeChar of selectedProject.scriptData.characters) {
  const char = getCharacterWithAssets(episodeChar, selectedProject.seriesRefId);
  if (char.referenceImage) {
    const hash = await md5Hash(char.referenceImage); // ⚠️ 串行等待
    if (!urlHashSet.has(hash)) {
      const file = findPormtFromHistory(historyFiles,hash);
      urlHashSet.add(hash);
      images.push({ /* ... */ });
    }
  }
  
  if (char.variations) {
    for (let idx = 0; idx < char.variations.length; idx++) {
      const outfit = char.variations[idx];
      if (outfit.referenceImage) {
        const hash = await md5Hash(outfit.referenceImage); // ⚠️ 再次等待
        // ...
      }
    }
  }
}

// 场景图片继续串行
for (const episodeScene of selectedProject.scriptData.scenes) {
  const scene = getSceneWithAssets(episodeScene, selectedProject.seriesRefId);
  if (scene.referenceImage) {
    const hash = await md5Hash(scene.referenceImage); // ⚠️ 继续等待
    // ...
  }
}

// 关键帧图片还是串行
for (let shotIdx = 0; shotIdx < selectedProject.shots.length; shotIdx++) {
  const shot = selectedProject.shots[shotIdx];
  if (shot.keyframes) {
    for (const kf of shot.keyframes) {
      if (kf.imageUrl) {
        const hash = await md5Hash(kf.imageUrl); // ⚠️ 无限循环等待
        // ...
      }
    }
  }
}
```

**性能影响**: 
- 🔴 假设有 180 个图片/视频需要计算 MD5
- 🔴 每个 MD5 需要 10ms
- 🔴 串行执行：180 × 10ms = **1800ms (1.8 秒)**
- 🔴 并行执行仅需：**~180ms (0.18 秒)**
- 🔴 **性能差距：10 倍！**

---

## 🟡 HIGH 优先级问题

### 5. 标签计数低效 - `js-combine-iterations`

#### ⚠️ 问题描述
对同一个数组进行了 4 次独立的 filter 操作。

```typescript
// 第 451-457 行
const tabCounts = useMemo(() => ({
  all: filteredImages.length,
  character: filteredImages.filter(i => i.type === 'character').length,      // ⚠️ 第 1 次遍历
  scene: filteredImages.filter(i => i.type === 'scene').length,              // ⚠️ 第 2 次遍历
  video: filteredImages.filter(i => i.type.startsWith('video')).length,      // ⚠️ 第 3 次遍历
  keyframe: filteredImages.filter(i => i.type.startsWith('keyframe')).length // ⚠️ 第 4 次遍历
}), [filteredImages]);
```

**影响**: 
- ⚠️ 如果 `filteredImages` 有 1000 张图片，将执行 4000 次检查
- ⚠️ 可以合并为单次遍历，减少 75% 的迭代

---

## 🟢 MEDIUM 优先级问题

### 6. 依赖数组不完整 - `rerender-dependencies`

#### ⚠️ 问题描述
`useEffect` 的依赖数组缺少 `getCharacterWithAssets` 和 `getSceneWithAssets`。

```typescript
// 第 431 行
}, [allProjects, seriesList, selectedProjectId, showVideo]);
// ⚠️ 缺少：getCharacterWithAssets, getSceneWithAssets
```

---

### 7. 大对象传递

#### ⚠️ 潜在问题
Props 中包含整个 `project` 对象。

```typescript
interface Props {
  project: ProjectState; // ⚠️ 整个项目对象
}
```

**建议**: 只传递需要的字段

---

## ✅ 已实现的最佳实践

### 1. ✅ 正确的 useMemo 使用

```typescript
// 第 434-457 行
const filteredImages = useMemo(() => {
  const query = searchQuery.toLowerCase().trim();
  if (!query) return allImages;

  return allImages.filter(img =>
    img.title.toLowerCase().includes(query) ||
    img.subtitle.toLowerCase().includes(query)
  );
}, [allImages, searchQuery]); // ✅ 正确的依赖

const displayImages = useMemo(() => {
  if (activeTab === 'all') return filteredImages;
  return filteredImages.filter(img => img.type.startsWith(activeTab));
}, [filteredImages, activeTab]); // ✅ 链式缓存
```

**优点**: 
- ✅ 避免每次渲染都重新过滤
- ✅ 依赖项正确且完整

---

### 2. ✅ Set 的正确使用

```typescript
// 第 184 行
const urlHashSet = new Set<string>(); // ✅ 使用 Set 进行 O(1) 查找

if (!urlHashSet.has(hash)) {
  urlHashSet.add(hash);
  // ...
}
```

**优点**: 
- ✅ O(1) 时间复杂度 vs O(n)
- ✅ 正确的去重策略

---

### 3. ✅ Promise.all() 并行加载

```typescript
// 第 52-55 行
const [projects, series] = await Promise.all([
  getAllProjectsMetadata(),
  getAllSeriesFromDB()
]);
```

**优点**: 
- ✅ 并行加载项目和连续剧
- ✅ 减少等待时间

---

## 📊 性能影响评估

### 当前性能瓶颈

| 问题 | 影响程度 | 频率 | 综合评分 |
|------|----------|------|----------|
| 水母流加载 | 🔴 高 | 每次切换项目 | 🔴🔴🔴 |
| Helper 函数未缓存 | 🟡 中 | 每次渲染 | 🟡🟡 |
| 事件处理函数未缓存 | 🟡 中 | 每次渲染 | 🟡🟡 |
| 4 次数组遍历 | 🟡 中 | 每次搜索/切换标签 | 🟡🟡 |

### 预估性能提升空间

修复所有 CRITICAL + HIGH 问题后：
- ⚡ **加载速度**: 提升 60-80%（并行化 MD5 计算）
- ⚡ **渲染性能**: 提升 40-50%（减少重复计算）
- ⚡ **子组件重渲染**: 减少 50-60%（稳定的函数引用）

---

## 🎯 修复优先级

### 立即修复 (CRITICAL)

1. **并行化 MD5 计算** - 使用分批并行处理
2. **缓存 Helper 函数** - 使用 `useCallback`
3. **缓存事件处理函数** - 使用 `useCallback`

### 短期优化 (HIGH)

4. **优化标签计数** - 合并为单次遍历
5. **完善依赖数组** - 添加缺失的依赖

---

## 💡 具体修复示例

### 修复 1: useCallback 缓存 Helper 函数

```typescript
// ✅ 修复后
const getCharacterWithAssets = useCallback((char: Character, projectSeriesRefId?: string): Character => {
  if (!projectSeriesRefId || !char.refId) return char;
  
  const series = seriesList.find(s => s.id === projectSeriesRefId);
  if (series?.library?.characters) {
    const libraryChar = series.library.characters.find(c => c.id === char.refId);
    if (libraryChar) return libraryChar;
  }
  return char;
}, [seriesList]);

const getSceneWithAssets = useCallback((scene: Scene, projectSeriesRefId?: string): Scene => {
  if (!projectSeriesRefId || !scene.refId) return scene;
  
  const series = seriesList.find(s => s.id === projectSeriesRefId);
  if (series?.library?.scenes) {
    const libraryScene = series.library.scenes.find(s => s.id === scene.refId);
    if (libraryScene) return libraryScene;
  }
  return scene;
}, [seriesList]);

const findPormtFromHistory = useCallback((historyFiles: MediaFile[], fileid: string) => {
  const file = historyFiles.find(f => f.id === fileid);
  if (file) return file;
  return { prompt: '', timestamp: 0 };
}, []);
```

---

### 修复 2: useCallback 缓存事件处理函数

```typescript
const handleDownloadImage = useCallback(async (imageUrl: string, charName: string) => {
  if(downloadStatus)return;
  setDownloadStatus('downloading');
  try{
    await downloadImage(imageUrl, `${charName}.png`, null);
  }finally{
    setDownloadStatus(null);
  }
}, [downloadStatus]);

const handleDeleteHistory = useCallback(async (image: ImageItem, e: React.MouseEvent) => {
  e.stopPropagation();
  if (!image.ishistory) return;
  try {
    const confirmed = await dialog.confirm({ /* ... */ });
    if (!confirmed) return;
    setAllImages(prevImages => prevImages.filter(img => img.id !== image.id));
    await deleteSingleMediaFile(image.projectId, image.id);
  } catch (error) {
    console.error('Failed to delete media history:', error);
  }
}, [dialog]);

const handleShowPrompt = useCallback((image: ImageItem, e: React.MouseEvent) => {
  e.stopPropagation();
  if (image.prompt) {
    setSelectedPrompt({ title: image.title, prompt: image.prompt, timestamp: image.timestamp });
    setShowPromptModal(true);
  }
}, []);
```

---

### 修复 3: 并行化 MD5 计算

```typescript
// ✅ 收集所有任务
interface ImageTask {
  url: string;
  id: string;
  type: ImageItem['type'];
  title: string;
  subtitle: string;
  downname: string;
  mediaType: 'image' | 'video';
}

const imageTasks: ImageTask[] = [];

// 角色图片
if (selectedProject.scriptData?.characters) {
  for (const episodeChar of selectedProject.scriptData.characters) {
    const char = getCharacterWithAssets(episodeChar, selectedProject.seriesRefId);
    if (char.referenceImage) {
      imageTasks.push({
        url: char.referenceImage,
        id: `char-${selectedProject.id}-${char.id}`,
        type: 'character',
        title: char.name,
        // ...
      });
    }
    // ... 造型图片
  }
}

// 场景、关键帧、视频...

// ✅ 批量并行计算 MD5（并发数：10）
const BATCH_SIZE = 10;
const md5Results: Array<{ task: ImageTask; hash: string }> = [];

for (let i = 0; i < imageTasks.length; i += BATCH_SIZE) {
  const batch = imageTasks.slice(i, i + BATCH_SIZE);
  const batchResults = await Promise.all(
    batch.map(async (task) => ({
      task,
      hash: await md5Hash(task.url)
    }))
  );
  md5Results.push(...batchResults);
}

// ✅ 处理结果
for (const { task, hash } of md5Results) {
  if (!urlHashSet.has(hash)) {
    const file = findPormtFromHistory(historyFiles, hash);
    urlHashSet.add(hash);
    images.push({
      id: task.id,
      hash,
      imageUrl: task.url,
      // ...
    });
  }
}
```

---

### 修复 4: 优化标签计数

```typescript
// ✅ 修复后：单次遍历
const tabCounts = useMemo(() => {
  const counts: Record<string, number> = {
    all: 0,
    character: 0,
    scene: 0,
    video: 0,
    keyframe: 0
  };
  
  for (const img of filteredImages) {
    counts.all++;
    if (img.type === 'character') counts.character++;
    else if (img.type === 'scene') counts.scene++;
    else if (img.type.startsWith('video')) counts.video++;
    else if (img.type.startsWith('keyframe')) counts.keyframe++;
  }
  
  return counts as typeof tabCounts;
}, [filteredImages]);
```

---

## 📝 总结

### 代码质量评分

| 维度 | 评分 | 说明 |
|------|------|------|
| **性能** | 🟡 6/10 | 存在明显的水母流问题 |
| **可维护性** | 🟢 8/10 | 代码结构清晰，注释充分 |
| **最佳实践** | 🟡 6/10 | 部分遵循 React 最佳实践 |
| **用户体验** | 🟢 8/10 | 功能完整，交互流畅 |

### 总体评价

**StageImage.tsx** 与 ImageSelectorModal.tsx 有相同的性能问题模式：

1. 🔴 **异步加载模式** - 串行 MD5 计算导致加载缓慢
2. 🟡 **Hooks 使用不当** - 未充分利用 `useCallback` 和 `useMemo`
3. 🟡 **循环效率** - 多次数组遍历可以优化

**建议优先修复 CRITICAL 问题**，预计可提升 60-80% 的加载性能。

---

**审查日期**: 2026-03-14  
**审查标准**: Vercel React Best Practices  
**审查人**: AI Code Reviewer
