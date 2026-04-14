import { AIModelConfig, ExportBundle, LLMCallLog, ProjectState, SeriesRecord } from '../types';

const DB_NAME = 'CineGenDB';
const DB_VERSION = 5; // Upgraded for LLM Call Log support
const STORE_NAME = 'projects';
const SERIES_STORE_NAME = 'series';
const MODEL_STORE_NAME = 'aiModels';
const MEDIA_HISTORY_STORE_NAME = 'mediaHistory';
const LLM_LOG_STORE_NAME = 'llmLogs';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(SERIES_STORE_NAME)) {
        db.createObjectStore(SERIES_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(MODEL_STORE_NAME)) {
        db.createObjectStore(MODEL_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(MEDIA_HISTORY_STORE_NAME)) {
        db.createObjectStore(MEDIA_HISTORY_STORE_NAME, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(LLM_LOG_STORE_NAME)) {
        const llmLogStore = db.createObjectStore(LLM_LOG_STORE_NAME, { keyPath: 'id' });
        llmLogStore.createIndex('requestTime', 'requestTime', { unique: false });
        llmLogStore.createIndex('modelType', 'modelType', { unique: false });
        llmLogStore.createIndex('provider', 'provider', { unique: false });
        llmLogStore.createIndex('success', 'success', { unique: false });
        llmLogStore.createIndex('taskId', 'taskId', { unique: false });
        llmLogStore.createIndex('projectId', 'projectId', { unique: false });
        llmLogStore.createIndex('seriesId', 'seriesId', { unique: false });
      }
    };
  });
};

export const saveProjectToDB = async (project: ProjectState, sync: boolean = false): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const p = !sync ? { ...project, lastModified: Date.now() } : project;
    const request = store.put(p);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// Helper function to migrate shot character names to IDs
const migrateShotCharacterNamesToIds = (project: ProjectState): ProjectState => {
  if (!project.scriptData?.characters || !project.shots) return project;
  
  const characterNameToId = new Map<string, string>();
  project.scriptData.characters.forEach(c => {
    characterNameToId.set(c.name, c.id);
  });
  
  const needsMigration = project.shots.some(shot => 
    shot.characters?.some(c => characterNameToId.has(c))
  );
  
  if (!needsMigration) return project;
  
  // Cache scriptData characters for faster lookup
  const scriptDataCharacters = project.scriptData.characters;
  
  const migratedShots = project.shots.map(shot => ({
    ...shot,
    characters: shot.characters?.map(c => {
      // If c is already an ID (exists in map values), keep it
      if (scriptDataCharacters.some(ch => ch.id === c)) return c;
      // Otherwise try to convert from name to ID
      return characterNameToId.get(c) || c;
    }) || []
  }));
  
  return { ...project, shots: migratedShots };
};

export const loadProjectFromDB = async (id: string): Promise<ProjectState> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) {
        const project = request.result as ProjectState;
        // Migrate old data: convert character names to IDs in shots
        const migratedProject = migrateShotCharacterNamesToIds(project);
        resolve(migratedProject);
      } else {
        reject(new Error("Project not found"));
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAllProjectsMetadata = async (): Promise<ProjectState[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll(); 
    request.onsuccess = () => {
       const projects = request.result as ProjectState[];
       // Sort by last modified descending
       projects.sort((a, b) => b.lastModified - a.lastModified);
       resolve(projects);
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * 根据 seriesRefId 获取连续剧下的全部剧集
 * @param seriesRefId - 连续剧ID
 * @returns 该连续剧下的所有剧集，按 lastModified 降序排列
 */
export const getEpisodesBySeriesId = async (seriesRefId: string): Promise<ProjectState[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const projects = request.result as ProjectState[];
      // Filter by seriesRefId and sort by last modified descending
      const episodes = projects
        .filter(p => p.seriesRefId === seriesRefId)
        .sort((a, b) => b.lastModified - a.lastModified);
      resolve(episodes);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteProjectFromDB = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

// ==================== Series CRUD Functions ====================

export const saveSeriesToDB = async (series: SeriesRecord): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SERIES_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SERIES_STORE_NAME);
    const updatedSeries = { ...series, updatedAt: Date.now() };
    const request = store.put(updatedSeries);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const loadSeriesFromDB = async (id: string): Promise<SeriesRecord> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SERIES_STORE_NAME, 'readonly');
    const store = tx.objectStore(SERIES_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) resolve(request.result);
      else reject(new Error("Series not found"));
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAllSeriesFromDB = async (): Promise<SeriesRecord[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SERIES_STORE_NAME, 'readonly');
    const store = tx.objectStore(SERIES_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const series = request.result as SeriesRecord[];
      // Sort by updatedAt descending
      series.sort((a, b) => b.updatedAt - a.updatedAt);
      resolve(series);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteSeriesFromDB = async (id: string, deleteEpisodes: boolean = false): Promise<void> => {
  const db = await openDB();
  
  // First load the series to get episode IDs
  const series = await loadSeriesFromDB(id);
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SERIES_STORE_NAME, STORE_NAME], 'readwrite');
    const seriesStore = tx.objectStore(SERIES_STORE_NAME);
    const projectStore = tx.objectStore(STORE_NAME);
    
    // Delete the series
    const deleteSeriesRequest = seriesStore.delete(id);
    deleteSeriesRequest.onsuccess = () => {
      // Optionally delete all episodes
      if (deleteEpisodes) {
        series.episodeOrder.forEach(episodeId => {
          projectStore.delete(episodeId);
        });
      } else {
        // Remove seriesRefId from episodes
        series.episodeOrder.forEach(episodeId => {
          const getRequest = projectStore.get(episodeId);
          getRequest.onsuccess = () => {
            const project = getRequest.result as ProjectState | undefined;
            if (project) {
              const { seriesRefId, ...rest } = project;
              projectStore.put(rest);
            }
          };
        });
      }
      resolve();
    };
    deleteSeriesRequest.onerror = () => reject(deleteSeriesRequest.error);
  });
};

// ==================== AI Model Config Functions ====================

export const saveModelConfig = async (config: AIModelConfig): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MODEL_STORE_NAME);
    const request = store.put(config);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const loadModelConfig = async (id: string): Promise<AIModelConfig> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE_NAME, 'readonly');
    const store = tx.objectStore(MODEL_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) resolve(request.result);
      else reject(new Error("Model config not found"));
    };
    request.onerror = () => reject(request.error);
  });
};

export const getAllModelConfigs = async (): Promise<AIModelConfig[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE_NAME, 'readonly');
    const store = tx.objectStore(MODEL_STORE_NAME);
    const request = store.getAll();
    request.onsuccess = () => {
      const configs = request.result as AIModelConfig[];
      resolve(configs);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteModelConfig = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MODEL_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MODEL_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};


// ==================== Media History Functions ====================

export interface MediaHistoryItem {
  id: string;
  projectId: string;
  character: MediaFile[];
  scene: MediaFile[];
  keyframe: MediaFile[];
  video: MediaFile[];
  audio: MediaFile[];
}

export interface MediaFile {
  id: string;
  fileUrl: string;
  fileName: string;
  timestamp: number;
  fileType: 'image' | 'video' | 'audio';
  mediaType: 'character' | 'scene' | 'full' | 'start' | 'end' | 'video' | 'transition' | 'prop';
  prompt: string;
}

/**
 * 截短数据中的大 base64 字段，减少存储空间
 * @param data - 要处理的数据对象
 * @param maxLength - base64 字符串最大长度，默认 1000 字符
 * @returns 处理后的数据（新对象，不修改原对象）
 */
const truncateBase64InData = <T extends any>(data: T, maxLength: number = 1000): T => {
  // 基本类型直接返回
  if (data === null || data === undefined || typeof data !== 'object') {
    return data;
  }

  // 处理数组
  if (Array.isArray(data)) {
    return data.map(item => truncateBase64InData(item, maxLength)) as any;
  }

  // 处理对象
  const result: any = {};
  for (const key in data) {
    if (Object.prototype.hasOwnProperty.call(data, key)) {
      const value = data[key];

      // 检查是否为 base64 字符串（data:image 或 data:video 或 data:audio）
      if (typeof value === 'string' && value.length > maxLength) {
        if (value.startsWith('data:image/') || 
            value.startsWith('data:video/') || 
            value.startsWith('data:audio/')) {
          // 截断 base64 数据，保留头部信息和部分内容
          const commaIndex = value.indexOf(',');
          if (commaIndex > 0) {
            const header = value.substring(0, commaIndex);
            const preview = value.substring(commaIndex + 1, Math.min(commaIndex + 1 + 100, value.length));
            result[key] = `${header},${preview}...[TRUNCATED: ${value.length - commaIndex - 1} chars]`;
          } else {
            result[key] = value.substring(0, maxLength) + '...[TRUNCATED]';
          }
        } else {
          // 非 base64 的大字符串也截断
          result[key] = value.substring(0, maxLength) + '...[TRUNCATED]';
        }
      } else if (typeof value === 'object' && value !== null) {
        // 递归处理嵌套对象
        result[key] = truncateBase64InData(value, maxLength);
      } else {
        // 其他类型直接复制
        result[key] = value;
      }
    }
  }

  return result;
};

// SHA-256 hash function compatible with all contexts
export async function md5Hash(str: string): Promise<string> {
  // 优先使用 crypto.subtle（安全上下文）
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const encoder = new TextEncoder();
      const data = encoder.encode(str);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex.substring(0, 32);
    } catch {
      // 回退到纯 JS 实现
    }
  }
  // 纯 JS SHA-256 实现（兼容所有环境）
  return sha256Js(str).substring(0, 32);
}

// 纯 JavaScript SHA-256 实现
function sha256Js(message: string): string {
  // ROTLEFT 函数
  const ROTL = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  // ROTRIGHT 函数
  const ROTR = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  // SHIFT 函数
  const SHR = (x: number, n: number) => x >>> n;

  // 椭圆函数
  const Ch = (x: number, y: number, z: number) => (x & y) ^ (~x & z);
  const Maj = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z);
  const Sigma0 = (x: number) => ROTR(x, 2) ^ ROTR(x, 13) ^ ROTR(x, 22);
  const Sigma1 = (x: number) => ROTR(x, 6) ^ ROTR(x, 11) ^ ROTR(x, 25);
  const sigma0 = (x: number) => ROTR(x, 7) ^ ROTR(x, 18) ^ SHR(x, 3);
  const sigma1 = (x: number) => ROTR(x, 17) ^ ROTR(x, 19) ^ SHR(x, 10);

  // SHA-256 常量
  const K: number[] = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  // 初始化哈希值
  let H0 = 0x6a09e667, H1 = 0xbb67ae85, H2 = 0x3c6ef372, H3 = 0xa54ff53a;
  let H4 = 0x510e527f, H5 = 0x9b05688c, H6 = 0x1f83d9ab, H7 = 0x5be0cd19;

  // 消息预处理
  const msgLen = message.length;
  const padLen = (msgLen % 64 < 56) ? (56 - msgLen % 64) : (120 - msgLen % 64);
  const paddedMsg = new Uint8Array(msgLen + padLen + 8);
  paddedMsg.set(new TextEncoder().encode(message), 0);
  paddedMsg[msgLen] = 0x80;
  const view = new DataView(paddedMsg.buffer);
  view.setUint32(paddedMsg.length - 4, msgLen * 8, false);

  // 处理消息块
  for (let chunk = 0; chunk < paddedMsg.length; chunk += 64) {
    const w = new Uint32Array(64);
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(chunk + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      w[i] = sigma1(w[i - 2]) + w[i - 7] + sigma0(w[i - 15]) + w[i - 16];
    }

    let a = H0, b = H1, c = H2, d = H3;
    let e = H4, f = H5, g = H6, h = H7;

    for (let i = 0; i < 64; i++) {
      const t1 = h + Sigma1(e) + Ch(e, f, g) + K[i] + w[i];
      const t2 = Sigma0(a) + Maj(a, b, c);
      h = g; g = f; f = e; e = d + t1;
      d = c; c = b; b = a; a = t1 + t2;
    }

    H0 += a; H1 += b; H2 += c; H3 += d;
    H4 += e; H5 += f; H6 += g; H7 += h;
  }

  // 输出哈希值
  const hash = [
    H0, H1, H2, H3, H4, H5, H6, H7
  ].map(v => v.toString(16).padStart(8, '0')).join('');
  return hash;
}

export const addMediaHistory = async (
  projectId: string,
  fileUrl: string,
  fileName: string,
  fileType: 'image' | 'video' | 'audio',
  mediaType: 'character' | 'scene' | 'full' | 'start' | 'end' | 'video' | 'transition'|'prop',
  prompt: string
): Promise<void> => {
  const filehash = await md5Hash(fileUrl);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_HISTORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEDIA_HISTORY_STORE_NAME);

      const mediaFile: MediaFile = {
        id:filehash,
        fileUrl,
        fileName,
        timestamp: Date.now(),
        fileType,
        mediaType,
        prompt
      };

      // Get existing project history
      const getRequest = store.get(projectId);
      getRequest.onsuccess = () => {
        let projectHistory: MediaHistoryItem | null = getRequest.result;

        if (!projectHistory) {
          // Create new project history
          projectHistory = {
            id: projectId,
            projectId,
            character: [],
            scene: [],
            keyframe: [],
            video: [],
            audio: []
          };
        }

        // Add media file to appropriate category
        if (mediaType === 'character') {
          // Check if file already exists
          if(fileType=='audio'){
            const exists = projectHistory.audio.some(f => f.id === projectId);
            if (!exists) {
              projectHistory.audio.push(mediaFile);
            }
          }else{
            const exists = projectHistory.character.some(f => f.id === projectId);
            if (!exists) {
              projectHistory.character.push(mediaFile);
            }
          }
        } else if (mediaType === 'scene') {
          const exists = projectHistory.scene.some(f => f.id === projectId);
          if (!exists) {
            projectHistory.scene.push(mediaFile);
          }
        } else if (mediaType === 'full' || mediaType === 'start' || mediaType === 'end') {
          const exists = projectHistory.keyframe.some(f => f.id === projectId);
          if (!exists) {
            projectHistory.keyframe.push(mediaFile);
          }
        } else {
          const exists = projectHistory.video.some(f => f.id === projectId);
          if (!exists) {
            projectHistory.video.push(mediaFile);
          }
        }

        // Sort category by timestamp descending
        const sortCategory = (category: MediaFile[]) => {
          category.sort((a, b) => b.timestamp - a.timestamp);
        };
        sortCategory(projectHistory.character);
        sortCategory(projectHistory.scene);
        sortCategory(projectHistory.keyframe);
        sortCategory(projectHistory.video);

        // Save updated history
        const putRequest = store.put(projectHistory);
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      getRequest.onerror = () => reject(getRequest.error);
    });
};

export const getProjectMediaHistory = async (
  projectId: string,
  mediaType?: 'character' | 'scene' | 'keyframe' | 'video'
): Promise<MediaFile[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_HISTORY_STORE_NAME, 'readonly');
    const store = tx.objectStore(MEDIA_HISTORY_STORE_NAME);
    const request = store.get(projectId);
    request.onsuccess = () => {
      const projectHistory = request.result as MediaHistoryItem | undefined;
      if (!projectHistory) {
        resolve([]);
        return;
      }

      // Return all media if no type specified, otherwise return specific type
      if (!mediaType) {
        const allMedia = [
          ...projectHistory.character,
          ...projectHistory.scene,
          ...projectHistory.keyframe,
          ...projectHistory.video
        ];
        allMedia.sort((a, b) => b.timestamp - a.timestamp);
        resolve(allMedia);
      } else {
        resolve(projectHistory[mediaType] || []);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteMediaHistory = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_HISTORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEDIA_HISTORY_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const deleteSingleMediaFile = async (
  projectId: string,
  mediaFileId: string
): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_HISTORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEDIA_HISTORY_STORE_NAME);
    const getRequest = store.get(projectId);
    getRequest.onsuccess = () => {
      const projectHistory = getRequest.result as MediaHistoryItem | undefined;
      if (!projectHistory) {
        resolve();
        return;
      }

      // 从所有分类中查找并删除指定文件
      projectHistory.character = projectHistory.character.filter(f => f.id !== mediaFileId);
      projectHistory.scene = projectHistory.scene.filter(f => f.id !== mediaFileId);
      projectHistory.keyframe = projectHistory.keyframe.filter(f => f.id !== mediaFileId);
      projectHistory.video = projectHistory.video.filter(f => f.id !== mediaFileId);

      // 保存更新后的历史记录
      const putRequest = store.put(projectHistory);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

export const deleteProjectMediaHistory = async (projectId: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_HISTORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEDIA_HISTORY_STORE_NAME);
    const index = store.index('projectId');
    const request = index.getAllKeys(projectId);
    request.onsuccess = () => {
      const keys = request.result;
      keys.forEach(key => store.delete(key));
      tx.oncomplete = () => resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

// Initial template for new projects
export const createNewProjectState = (seriesDefaults?: {
  targetDuration?: string;
  language?: string;
  genre?: string;
  visualStyle?: string;
  imageSize?: string;
  imageCount?: number;
  rawScript?: string;
}): ProjectState => {
  const id = 'proj_' + Date.now().toString(36);
  return {
    id,
    title: '未命名项目',
    seed: Math.floor(Math.random() * 1000000000),
    createdAt: Date.now(),
    lastModified: Date.now(),
    stage: 'script',
    targetDuration: seriesDefaults?.targetDuration || '60s', // Default duration now 60s
    language: seriesDefaults?.language || '中文', // Default language
    genre: seriesDefaults?.genre || '剧情片',
    visualStyle: seriesDefaults?.visualStyle || '真人写实',
    imageSize: seriesDefaults?.imageSize || '2560x1440', // Default image size (vertical)
    imageCount: seriesDefaults?.imageCount ?? 0, // Default image count (1 image per generation)
    rawScript: seriesDefaults?.rawScript || `标题：示例剧本`,
    scriptData: null,
    shots: [],
    isParsingScript: false,
    // Segment mode default values
    isSegmentMode: false,
    segments: [],
    // Default to empty providers (will be set by user)
    modelProviders: {
      llm: undefined,
      text2image: undefined,
      image2video: undefined,
    },
    segmentDuration: 15,
  };
};

// ==================== Export/Import Functions (v2 with Series support) ====================

// Export standalone project to JSON file
export const exportProjectToFile = (project: ProjectState): void => {
  const bundle: ExportBundle = {
    version: 2,
    exportedAt: Date.now(),
    type: 'standalone',
    project
  };
  const dataStr = JSON.stringify(bundle, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.target = "_blank";
  link.download = `${project.title}_${project.id}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Export series with all episodes to JSON file
export const exportSeriesToFile = (series: SeriesRecord, episodes: ProjectState[]): void => {
  const bundle: ExportBundle = {
    version: 2,
    exportedAt: Date.now(),
    type: 'series',
    series,
    projects: episodes
  };
  const dataStr = JSON.stringify(bundle, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.target = "_blank";
  link.download = `${series.title}_${series.id}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Import result type
export interface ImportResult {
  type: 'standalone' | 'series';
  project?: ProjectState;
  series?: SeriesRecord;
  projects?: ProjectState[];
}

// Import project or series from JSON file
export const importFromFile = (): Promise<ImportResult> => {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';

    let eventTriggered = false;

    input.onchange = async (e) => {
      eventTriggered = true;
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error('No file selected'));
        return;
      }

      try {
        const text = await file.text();
        const data = JSON.parse(text);

        // Check if it's a v2 bundle
        if (data.version === 2) {
          const bundle = data as ExportBundle;
          if (bundle.type === 'standalone' && bundle.project) {
            // Migrate character names to IDs in shots
            const migratedProject = migrateShotCharacterNamesToIds(bundle.project);
            resolve({ type: 'standalone', project: migratedProject });
          } else if (bundle.type === 'series' && bundle.series) {
            // Migrate all projects in series
            const migratedProjects = (bundle.projects || []).map(migrateShotCharacterNamesToIds);
            resolve({ type: 'series', series: bundle.series, projects: migratedProjects });
          } else {
            reject(new Error('Invalid bundle format'));
          }
        } else if (data.id && data.title && data.createdAt) {
          // Legacy v1 format (just ProjectState)
          const project = data as ProjectState;
          const migratedProject = migrateShotCharacterNamesToIds(project);
          resolve({ type: 'standalone', project: migratedProject });
        } else {
          reject(new Error('Invalid file format'));
        }
      } catch (error) {
        reject(error);
      }
    };
    input.onabort = () => {
      if (!eventTriggered) {
        reject(new Error('Import cancelled'));
      }
    };
    input.oncancel = () => {
      if (!eventTriggered) {
        reject(new Error('Import cancelled'));
      }
    };
    input.click();
  });
};

// Legacy import function (for backward compatibility)
export const importProjectFromFile = (): Promise<ProjectState> => {
  return new Promise((resolve, reject) => {
    importFromFile()
      .then(result => {
        if (result.type === 'standalone' && result.project) {
          resolve(result.project);
        } else {
          reject(new Error('File is a series bundle, not a standalone project'));
        }
      })
      .catch(reject);
  });
};

// ==================== LLM Call Log Functions ====================

export const saveLLMLog = async (log: LLMCallLog): Promise<void> => {
  // 截短 requestParams 和 response 中的 base64 数据
  const truncatedLog: LLMCallLog = {
    ...log,
    requestParams: truncateBase64InData(log.requestParams, 8192),
    response: truncateBase64InData(log.response, 8192)
  };
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LLM_LOG_STORE_NAME, 'readwrite');
    const store = tx.objectStore(LLM_LOG_STORE_NAME);
    const request = store.put(truncatedLog);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const getLLMLog = async (id: string): Promise<LLMCallLog | undefined> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LLM_LOG_STORE_NAME, 'readonly');
    const store = tx.objectStore(LLM_LOG_STORE_NAME);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export interface LLMLogFilter {
  startTime?: number;
  endTime?: number;
  modelType?: LLMCallLog['modelType'];
  provider?: string;
  success?: boolean;
  projectId?: string;
  seriesId?: string;
  taskId?: string;
  limit?: number;
  offset?: number;
  isAsyncTask?: boolean;
  taskStatus?: LLMCallLog['taskStatus'];
}

export const queryLLMLogs = async (filter: LLMLogFilter = {}): Promise<LLMCallLog[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LLM_LOG_STORE_NAME, 'readonly');
    const store = tx.objectStore(LLM_LOG_STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      let logs = request.result as LLMCallLog[];
      
      // Apply filters
      if (filter.startTime) {
        logs = logs.filter(log => log.requestTime >= filter.startTime!);
      }
      if (filter.endTime) {
        logs = logs.filter(log => log.requestTime <= filter.endTime!);
      }
      if (filter.modelType) {
        logs = logs.filter(log => log.modelType === filter.modelType);
      }
      if (filter.provider) {
        logs = logs.filter(log => log.provider === filter.provider);
      }
      if (filter.success !== undefined) {
        logs = logs.filter(log => log.success === filter.success);
      }
      if (filter.projectId) {
        logs = logs.filter(log => log.projectId === filter.projectId);
      }
      if (filter.seriesId) {
        logs = logs.filter(log => log.seriesId === filter.seriesId);
      }
      if (filter.taskId) {
        logs = logs.filter(log => log.taskId === filter.taskId);
      }
      
      // Sort by request time descending
      logs.sort((a, b) => b.requestTime - a.requestTime);
      
      // Apply pagination
      const offset = filter.offset || 0;
      const limit = filter.limit || logs.length;
      resolve(logs.slice(offset, offset + limit));
    };
    request.onerror = () => reject(request.error);
  });
};

export const countLLMLogs = async (filter: LLMLogFilter = {}): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LLM_LOG_STORE_NAME, 'readonly');
    const store = tx.objectStore(LLM_LOG_STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      let logs = request.result as LLMCallLog[];
      
      // Apply filters (same as queryLLMLogs but without pagination)
      if (filter.startTime) {
        logs = logs.filter(log => log.requestTime >= filter.startTime!);
      }
      if (filter.endTime) {
        logs = logs.filter(log => log.requestTime <= filter.endTime!);
      }
      if (filter.modelType) {
        logs = logs.filter(log => log.modelType === filter.modelType);
      }
      if (filter.provider) {
        logs = logs.filter(log => log.provider === filter.provider);
      }
      if (filter.success !== undefined) {
        logs = logs.filter(log => log.success === filter.success);
      }
      if (filter.projectId) {
        logs = logs.filter(log => log.projectId === filter.projectId);
      }
      if (filter.seriesId) {
        logs = logs.filter(log => log.seriesId === filter.seriesId);
      }
      if (filter.taskId) {
        logs = logs.filter(log => log.taskId === filter.taskId);
      }
      
      resolve(logs.length);
    };
    request.onerror = () => reject(request.error);
  });
};

export const deleteLLMLog = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LLM_LOG_STORE_NAME, 'readwrite');
    const store = tx.objectStore(LLM_LOG_STORE_NAME);
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearLLMLogs = async (): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LLM_LOG_STORE_NAME, 'readwrite');
    const store = tx.objectStore(LLM_LOG_STORE_NAME);
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
};

export const clearOldLLMLogs = async (beforeTime: number): Promise<number> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LLM_LOG_STORE_NAME, 'readwrite');
    const store = tx.objectStore(LLM_LOG_STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const logs = request.result as LLMCallLog[];
      const oldLogs = logs.filter(log => log.requestTime < beforeTime);
      
      let deletedCount = 0;
      oldLogs.forEach(log => {
        store.delete(log.id);
        deletedCount++;
      });
      
      tx.oncomplete = () => resolve(deletedCount);
    };
    request.onerror = () => reject(request.error);
  });
};

export interface LLMLogStats {
  totalLogs: number;
  successCount: number;
  failedCount: number;
  avgDuration: number;
  modelTypeCounts: Record<string, number>;
  providerCounts: Record<string, number>;
}

export const getLLMLogStats = async (filter: LLMLogFilter = {}): Promise<LLMLogStats> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LLM_LOG_STORE_NAME, 'readonly');
    const store = tx.objectStore(LLM_LOG_STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      let logs = request.result as LLMCallLog[];
      
      // Apply filters
      if (filter.startTime) {
        logs = logs.filter(log => log.requestTime >= filter.startTime!);
      }
      if (filter.endTime) {
        logs = logs.filter(log => log.requestTime <= filter.endTime!);
      }
      
      const totalLogs = logs.length;
      const successCount = logs.filter(log => log.success).length;
      const failedCount = totalLogs - successCount;
      const avgDuration = totalLogs > 0 
        ? logs.reduce((sum, log) => sum + log.duration, 0) / totalLogs 
        : 0;
      
      const modelTypeCounts: Record<string, number> = {};
      const providerCounts: Record<string, number> = {};
      
      logs.forEach(log => {
        modelTypeCounts[log.modelType] = (modelTypeCounts[log.modelType] || 0) + 1;
        providerCounts[log.provider] = (providerCounts[log.provider] || 0) + 1;
      });
      
      resolve({
        totalLogs,
        successCount,
        failedCount,
        avgDuration,
        modelTypeCounts,
        providerCounts
      });
    };
    request.onerror = () => reject(request.error);
  });
};

/**
 * 更新媒体历史记录中的文件 URL
 */
export const updateMediaHistoryFileUrl = async (
  projectId: string,
  oldUrl: string,
  newUrl: string
): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(MEDIA_HISTORY_STORE_NAME, 'readwrite');
    const store = tx.objectStore(MEDIA_HISTORY_STORE_NAME);
    const getRequest = store.get(projectId);
    
    getRequest.onsuccess = () => {
      const projectHistory = getRequest.result as MediaHistoryItem | undefined;
      if (!projectHistory) {
        resolve();
        return;
      }
      
      const updateCategory = async (items: MediaFile[]) => {
        for (const item of items) {
          if (item.fileUrl === oldUrl) {
            item.fileUrl = newUrl;
            item.id = await md5Hash(newUrl);
          }
        }
      };
      
      updateCategory(projectHistory.character || []);
      updateCategory(projectHistory.scene || []);
      updateCategory(projectHistory.keyframe || []);
      updateCategory(projectHistory.video || []);
      updateCategory(projectHistory.audio || []);
      
      const putRequest = store.put(projectHistory);
      putRequest.onsuccess = () => resolve();
      putRequest.onerror = () => reject(putRequest.error);
    };
    
    getRequest.onerror = () => reject(getRequest.error);
  });
};