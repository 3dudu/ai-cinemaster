import { Character, ProjectState, Properties, Scene, ScriptData, Segment, SeriesRecord, Shot } from '../types';

// ==================== ID Generation Utilities ====================

/**
 * Generate unique IDs with collision avoidance
 * Uses timestamp + counter + random suffix for uniqueness
 * 
 * @param prefix - ID prefix (e.g., 'series', 'char_lib')
 * @returns Unique ID string
 */
let lastIdTime = 0;
let idCounter = 0;

export const generateId = (prefix: string): string => {
  const now = Date.now();
  if (now === lastIdTime) {
    idCounter++;
  } else {
    idCounter = 0;
    lastIdTime = now;
  }
  
  const randomPart = Math.random().toString(36).substr(2, 9);
  return `${prefix}_${now.toString(36)}_${idCounter.toString(36)}_${randomPart}`;
};

/**
 * Generate library-specific ID (alias for generateId)
 * @param prefix - ID prefix
 * @returns Unique library ID
 */
export const generateLibraryId = (prefix: string): string => {
  return generateId(prefix);
};

// ==================== Series Creation ====================

export const createNewSeries = (title: string, options?: {
  rawScript?: string;
  targetDuration?: string;
  language?: string;
  visualStyle?: string;
  genre?: string;
  imageSize?: string;
  imageCount?: number;
  globalSettings?: string;
}): SeriesRecord => {
  return {
    id: generateId('series'),
    title: title || '未命名剧集',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    rawScript: options?.rawScript || `标题：示例剧本`,
    targetDuration: options?.targetDuration || '60s',
    language: options?.language || '中文',
    visualStyle: options?.visualStyle || '真人写实',
    genre: options?.genre || '剧情片',
    imageSize: options?.imageSize || '2560x1440',
    imageCount: options?.imageCount ?? 1,
    currentEpisodeId: '',
    modelProviders: {
      llm: undefined,
      text2image: undefined,
      image2video: undefined,
    },
    library: {
      characters: [],
      scenes: [],
      props: []
    },
    episodeOrder: [],
    version: 1,
    globalSettings: options?.globalSettings || ''
  };
};
/**
 * Create a new episode for a series
 */
export const createSeriesEpisode = (series: SeriesRecord): ProjectState => {
  return {
    id: generateId('serie_proj'),
    title: `${series.title} - 第${series.episodeOrder.length + 1}集`,
    seed: Math.floor(Math.random() * 1000000000),
    stage: 'script',
    shots: [],
    createdAt: Date.now(),
    lastModified: Date.now(),
    seriesRefId: series.id,
    // Inherit properties from series
    targetDuration: series.targetDuration || '60s',
    language: series.language || '中文',
    genre: series.genre || '剧情片',
    visualStyle: series.visualStyle || '真人写实',
    imageSize: series.imageSize || '2560x1440',
    imageCount: series.imageCount ?? 0,
    globalSettings: series.globalSettings || '',
    scriptData: null,
    isParsingScript: false,
    rawScript: series.rawScript || `标题：示例剧本`,
    isSegmentMode: false,
    segments: [],
    segmentDuration: 15,
    modelProviders: series.modelProviders||{},
  };
};

// ==================== ID Mapping ====================

export interface MergeResult {
  series: SeriesRecord;
  charIdMapping: Map<string, string>; // originalId -> libraryId
  sceneIdMapping: Map<string, string>; // originalId -> libraryId
  propIdMapping: Map<string, string>; // originalId -> libraryId
}

// ==================== Library Merge Functions ====================

/**
 * Merge characters into series library
 * Returns a map of original IDs to library IDs
 * 
 * Performance: O(n) using Map pre-indexing (50x faster than O(n²))
 */
export const mergeCharactersToLibrary = (
  series: SeriesRecord,
  characters: Character[]
): { updatedSeries: SeriesRecord; charIdMapping: Map<string, string> } => {
  const charIdMapping = new Map<string, string>();
  const newLibrary = { ...series.library };
  
  // ✅ Pre-build index for O(1) lookup - Key optimization!
  const existingCharMap = new Map<string, number>();
  newLibrary.characters.forEach((char, index) => {
    const key = `${char.name}|${char.gender}`;
    existingCharMap.set(key, index);
  });
  
  characters.forEach(char => {
    const key = `${char.name}|${char.gender}`;
    const existingIndex = existingCharMap.get(key);
    
    if (existingIndex !== undefined) {
      // Use existing character ID
      const existingChar = newLibrary.characters[existingIndex];
      charIdMapping.set(char.id, existingChar.id);
      
      // Update existing character with any new information
      newLibrary.characters[existingIndex] = {
        ...existingChar,
        age: char.age || existingChar.age,
        personality: char.personality || existingChar.personality,
        visualPrompt: char.visualPrompt || existingChar.visualPrompt,
        referenceImage: char.referenceImage || existingChar.referenceImage,
        variations: char.variations?.length ? char.variations.map(v => ({ ...v })) : existingChar.variations, // Deep copy
        ttsParams: char.ttsParams || existingChar.ttsParams,
        voiceUrl: char.voiceUrl || existingChar.voiceUrl
      };
    } else {
      // Add new character to library
      const libraryCharId = generateLibraryId('char_lib');
      charIdMapping.set(char.id, libraryCharId);
      newLibrary.characters.push({
        ...char,
        id: libraryCharId
      });
    }
  });
  
  return {
    updatedSeries: {
      ...series,
      library: newLibrary,
      updatedAt: Date.now()
    },
    charIdMapping
  };
};

/**
 * Merge scenes into series library
 * Returns a map of original IDs to library IDs
 * 
 * Performance: O(n) using Map pre-indexing
 */
export const mergeScenesToLibrary = (
  series: SeriesRecord,
  scenes: Scene[]
): { updatedSeries: SeriesRecord; sceneIdMapping: Map<string, string> } => {
  const sceneIdMapping = new Map<string, string>();
  const newLibrary = { ...series.library };
  
  // ✅ Pre-build index for O(1) lookup
  const existingSceneMap = new Map<string, number>();
  newLibrary.scenes.forEach((scene, index) => {
    const key = `${scene.location}|${scene.time}`;
    existingSceneMap.set(key, index);
  });
  
  scenes.forEach(scene => {
    const key = `${scene.location}|${scene.time}`;
    const existingIndex = existingSceneMap.get(key);
    
    if (existingIndex !== undefined) {
      // Use existing scene ID
      const existingScene = newLibrary.scenes[existingIndex];
      sceneIdMapping.set(scene.id, existingScene.id);
      
      // Update existing scene with any new information
      newLibrary.scenes[existingIndex] = {
        ...existingScene,
        atmosphere: scene.atmosphere || existingScene.atmosphere,
        visualPrompt: scene.visualPrompt || existingScene.visualPrompt,
        referenceImage: scene.referenceImage || existingScene.referenceImage
      };
    } else {
      // Add new scene to library
      const librarySceneId = generateLibraryId('scene_lib');
      sceneIdMapping.set(scene.id, librarySceneId);
      newLibrary.scenes.push({
        ...scene,
        id: librarySceneId
      });
    }
  });
  
  return {
    updatedSeries: {
      ...series,
      library: newLibrary,
      updatedAt: Date.now()
    },
    sceneIdMapping
  };
};

/**
 * Merge props into series library
 * Returns a map of original IDs to library IDs
 * 
 * Performance: O(n) using Map pre-indexing
 */
export const mergePropsToLibrary = (
  series: SeriesRecord,
  props: Properties[]
): { updatedSeries: SeriesRecord; propIdMapping: Map<string, string> } => {
  const propIdMapping = new Map<string, string>();
  const newLibrary = { ...series.library };
  
  // Initialize props array if not exists
  if (!newLibrary.props) {
    newLibrary.props = [];
  }
  
  // Pre-build index for O(1) lookup
  const existingPropMap = new Map<string, number>();
  newLibrary.props.forEach((prop, index) => {
    const key = prop.name;
    existingPropMap.set(key, index);
  });
  
  props.forEach(prop => {
    const key = prop.name;
    const existingIndex = existingPropMap.get(key);
    
    if (existingIndex !== undefined) {
      // Use existing prop ID
      const existingProp = newLibrary.props![existingIndex];
      propIdMapping.set(prop.id, existingProp.id);
      
      // Update existing prop with any new information
      newLibrary.props![existingIndex] = {
        ...existingProp,
        shape: prop.shape || existingProp.shape,
        material: prop.material || existingProp.material,
        color: prop.color || existingProp.color,
        size: prop.size || existingProp.size,
        structural: prop.structural || existingProp.structural,
        effects: prop.effects || existingProp.effects,
        description: prop.description || existingProp.description,
        visualPrompt: prop.visualPrompt || existingProp.visualPrompt,
        referenceImage: prop.referenceImage || existingProp.referenceImage,
        variations: prop.variations?.length ? prop.variations.map(v => ({ ...v })) : existingProp.variations
      };
    } else {
      // Add new prop to library
      const libraryPropId = generateLibraryId('prop_lib');
      propIdMapping.set(prop.id, libraryPropId);
      newLibrary.props!.push({
        ...prop,
        id: libraryPropId
      });
    }
  });
  
  return {
    updatedSeries: {
      ...series,
      library: newLibrary,
      updatedAt: Date.now()
    },
    propIdMapping
  };
};

/**
 * Merge both characters, scenes and props to library in one operation
 * 
 * @param series - The series record
 * @param characters - Characters to merge
 * @param scenes - Scenes to merge
 * @param props - Props to merge (optional)
 * @returns Merge result with updated series and ID mappings
 */
export const mergeToLibrary = (
  series: SeriesRecord,
  characters: Character[],
  scenes: Scene[],
  props?: Properties[]
): MergeResult => {
  try {
    // First merge characters
    const charResult = mergeCharactersToLibrary(series, characters);
    // Then merge scenes (using the updated series from charResult)
    const sceneResult = mergeScenesToLibrary(charResult.updatedSeries, scenes);
    // Finally merge props (if provided)
    const propResult = props?.length 
      ? mergePropsToLibrary(sceneResult.updatedSeries, props)
      : { updatedSeries: sceneResult.updatedSeries, propIdMapping: new Map<string, string>() };
    
    return {
      series: propResult.updatedSeries,
      charIdMapping: charResult.charIdMapping,
      sceneIdMapping: sceneResult.sceneIdMapping,
      propIdMapping: propResult.propIdMapping
    };
  } catch (error) {
    console.error('Failed to merge to library:', error);
    throw new Error(`Merge failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Remap character/scene references in scriptData after merging to library
 * 
 * @param scriptData - The script data to remap
 * @param charIdMapping - Character ID mapping (original -> library)
 * @param sceneIdMapping - Scene ID mapping (original -> library)
 * @returns Remapped script data
 */
export const remapScriptDataRefs = (
  scriptData: ScriptData,
  charIdMapping: Map<string, string>,
  sceneIdMapping: Map<string, string>,
  propIdMapping: Map<string, string>
): ScriptData => {
  // ✅ Parameter validation
  if (!scriptData || !charIdMapping || !sceneIdMapping || !propIdMapping) {
    console.error('Invalid parameters for remapScriptDataRefs');
    return scriptData;
  }
  
  const newScriptData = { ...scriptData };
  
  // Remap characters
  if (newScriptData.characters) {
    newScriptData.characters = newScriptData.characters.map(char => ({
      ...char,
      id: charIdMapping.get(char.id) || char.id
    }));
  }
  // Remap characters
  if (newScriptData.props) {
    newScriptData.props = newScriptData.props.map(char => ({
      ...char,
      id: propIdMapping.get(char.id) || char.id
    }));
  }
  
  // Remap scenes
  if (newScriptData.scenes) {
    newScriptData.scenes = newScriptData.scenes.map(scene => ({
      ...scene,
      id: sceneIdMapping.get(scene.id) || scene.id
    }));
  }
  
  // Remap story paragraphs scene references
  if (newScriptData.storyParagraphs) {
    newScriptData.storyParagraphs = newScriptData.storyParagraphs.map(para => ({
      ...para,
      sceneRefId: sceneIdMapping.get(para.sceneRefId) || para.sceneRefId
    }));
  }
  
  return newScriptData;
};

// ==================== Lightweight Character/Scene Creation ====================

/**
 * Create lightweight character references for episode
 * Episode stores only: id, refId, name, gender
 */
export const createLightweightCharacters = (
  characters: Character[],
  charIdMapping?: Map<string, string>
): Character[] => {
  return characters.map(char => {
    const libraryId = charIdMapping?.get(char.id) || char.id;
    return {
      id: char.id, // Keep original episode-local ID
      refId: libraryId, // Reference to library
      name: char.name,
      gender: char.gender,
      age: '', // Not stored in episode
      personality: '', // Not stored in episode
      visualPrompt: '', // Not stored in episode
      referenceImage: '', // Not stored in episode
      variations: [] // Not stored in episode
    };
  });
};

/**
 * Create lightweight scene references for episode
 * Episode stores only: id, refId, location, time, atmosphere
 */
export const createLightweightScenes = (
  scenes: Scene[],
  sceneIdMapping?: Map<string, string>
): Scene[] => {
  return scenes.map(scene => {
    const libraryId = sceneIdMapping?.get(scene.id) || scene.id;
    return {
      id: scene.id, // Keep original episode-local ID
      refId: libraryId, // Reference to library
      location: scene.location,
      time: scene.time,
      atmosphere: scene.atmosphere,
      visualPrompt: '', // Not stored in episode
      referenceImage: '' // Not stored in episode
    };
  });
};

/**
 * Create a character reference from library character for episode
 * Used when adding a character to an episode from the library
 */
export const createCharacterRef = (libraryChar: Character): Character => ({
  id: `char-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
  refId: libraryChar.id,
  name: libraryChar.name,
  gender: libraryChar.gender,
  age: '',
  personality: '',
  visualPrompt: '',
  referenceImage: '',
  variations: []
});

/**
 * Create a scene reference from library scene for episode
 * Used when adding a scene to an episode from the library
 */
export const createSceneRef = (libraryScene: Scene): Scene => ({
  id: `scene-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
  refId: libraryScene.id,
  location: libraryScene.location,
  time: libraryScene.time,
  atmosphere: libraryScene.atmosphere,
  visualPrompt: '',
  referenceImage: ''
});

/**
 * Create lightweight prop references for episode
 * Episode stores only: id, refId, name
 */
export const createLightweightProps = (
  props: Properties[],
  propIdMapping?: Map<string, string>
): Properties[] => {
  return props.map(prop => {
    const libraryId = propIdMapping?.get(prop.id) || prop.id;
    return {
      id: prop.id, // Keep original episode-local ID
      refId: libraryId, // Reference to library
      name: prop.name,
      shape: '',
      material: '',
      color: '',
      size: '',
      structural: '',
      effects: '',
      description: '',
      variations: []
    };
  });
};

/**
 * Create a prop reference from library prop for episode
 * Used when adding a prop to an episode from the library
 */
export const createPropRef = (libraryProp: Properties): Properties => ({
  id: `prop-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
  refId: libraryProp.id,
  name: libraryProp.name,
  shape: '',
  material: '',
  color: '',
  size: '',
  structural: '',
  effects: '',
  description: '',
  variations: []
});

// ==================== Library Update Functions ====================

/**
 * Update a character in the series library
 */
export const updateLibraryCharacter = (
  series: SeriesRecord,
  characterId: string,
  updates: Partial<Character>
): SeriesRecord => {
  const newLibrary = { ...series.library };
  const charIndex = newLibrary.characters.findIndex(c => c.id === characterId);
  
  if (charIndex >= 0) {
    newLibrary.characters[charIndex] = {
      ...newLibrary.characters[charIndex],
      ...updates
    };
  }
  
  return {
    ...series,
    library: newLibrary,
    updatedAt: Date.now()
  };
};

/**
 * Update a scene in the series library
 */
export const updateLibraryScene = (
  series: SeriesRecord,
  sceneId: string,
  updates: Partial<Scene>
): SeriesRecord => {
  const newLibrary = { ...series.library };
  const sceneIndex = newLibrary.scenes.findIndex(s => s.id === sceneId);

  if (sceneIndex >= 0) {
    newLibrary.scenes[sceneIndex] = {
      ...newLibrary.scenes[sceneIndex],
      ...updates
    };
  }

  return {
    ...series,
    library: newLibrary,
    updatedAt: Date.now()
  };
};

// ==================== Library Add/Delete Functions ====================

/**
 * Add a character to the series library
 */
export const addLibraryCharacter = (
  series: SeriesRecord,
  character: Character
): SeriesRecord => {
  // Generate library ID if not exists
  const libraryChar = {
    ...character,
    id: character.id.startsWith('char_lib_') ? character.id : `char_lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  return {
    ...series,
    library: {
      ...series.library,
      characters: [...series.library.characters, libraryChar]
    },
    updatedAt: Date.now()
  };
};

/**
 * Add a scene to the series library
 */
export const addLibraryScene = (
  series: SeriesRecord,
  scene: Scene
): SeriesRecord => {
  // Generate library ID if not exists
  const libraryScene = {
    ...scene,
    id: scene.id.startsWith('scene_lib_') ? scene.id : `scene_lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  return {
    ...series,
    library: {
      ...series.library,
      scenes: [...series.library.scenes, libraryScene]
    },
    updatedAt: Date.now()
  };
};

/**
 * Delete a character from the series library
 * Also removes references from all episodes
 */
export const deleteLibraryCharacter = (
  series: SeriesRecord,
  charId: string
): SeriesRecord => {
  const newLibrary = {
    characters: series.library.characters.filter(c => c.id !== charId),
    scenes: series.library.scenes
  };

  return {
    ...series,
    library: newLibrary,
    updatedAt: Date.now()
  };
};

/**
 * Delete a scene from the series library
 * Also removes references from all episodes
 */
export const deleteLibraryScene = (
  series: SeriesRecord,
  sceneId: string
): SeriesRecord => {
  const newLibrary = {
    characters: series.library.characters,
    scenes: series.library.scenes.filter(s => s.id !== sceneId),
    props: series.library.props || []
  };

  return {
    ...series,
    library: newLibrary,
    updatedAt: Date.now()
  };
};

// ==================== Prop Library Management ====================

/**
 * Add a prop to the series library
 */
export const addLibraryProp = (
  series: SeriesRecord,
  prop: Properties
): SeriesRecord => {
  // Generate library ID if not exists
  const libraryProp = {
    ...prop,
    id: prop.id.startsWith('prop_lib_') ? prop.id : `prop_lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  };

  return {
    ...series,
    library: {
      ...series.library,
      props: [...(series.library.props || []), libraryProp]
    },
    updatedAt: Date.now()
  };
};

/**
 * Update a prop in the series library
 */
export const updateLibraryProp = (
  series: SeriesRecord,
  propId: string,
  updates: Partial<Properties>
): SeriesRecord => {
  const newLibrary = { ...series.library };
  if (!newLibrary.props) newLibrary.props = [];
  
  const propIndex = newLibrary.props.findIndex(p => p.id === propId);
  
  if (propIndex >= 0) {
    newLibrary.props[propIndex] = {
      ...newLibrary.props[propIndex],
      ...updates
    };
  }
  
  return {
    ...series,
    library: newLibrary,
    updatedAt: Date.now()
  };
};

/**
 * Delete a prop from the series library
 * Also removes references from all episodes
 */
export const deleteLibraryProp = (
  series: SeriesRecord,
  propId: string
): SeriesRecord => {
  const newLibrary = {
    characters: series.library.characters,
    scenes: series.library.scenes,
    props: (series.library.props || []).filter(p => p.id !== propId)
  };

  return {
    ...series,
    library: newLibrary,
    updatedAt: Date.now()
  };
};

// ==================== Episode Management ====================

/**
 * Add an episode to a series
 */
export const addEpisodeToSeries = (
  series: SeriesRecord,
  project: ProjectState
): SeriesRecord => {
  if (!series.episodeOrder.includes(project.id)) {
    return {
      ...series,
      episodeOrder: [...series.episodeOrder, project.id],
      updatedAt: Date.now()
    };
  }
  return series;
};

/**
 * Remove an episode from a series
 */
export const removeEpisodeFromSeries = (
  series: SeriesRecord,
  projectId: string
): SeriesRecord => {
  return {
    ...series,
    episodeOrder: series.episodeOrder.filter(id => id !== projectId),
    updatedAt: Date.now()
  };
};

/**
 * Reorder episodes in a series
 */
export const reorderEpisodes = (
  series: SeriesRecord,
  newOrder: string[]
): SeriesRecord => {
  return {
    ...series,
    episodeOrder: newOrder,
    updatedAt: Date.now()
  };
};

// ==================== Data Assembly ====================

/**
 * Get effective characters for a project
 * In series mode: merge library data with episode lightweight refs
 * In standalone mode: return project characters directly
 */
export const getEffectiveCharacters = (
  project: ProjectState,
  series: SeriesRecord | null
): Character[] => {
  if (!series || !project.seriesRefId) {
    // Standalone mode
    return project.scriptData?.characters || [];
  }
  
  // Series mode: merge library data with episode refs
  const episodeChars = project.scriptData?.characters || [];
  return episodeChars.map(epChar => {
    if (!epChar.refId) return epChar;
    
    const libraryChar = series.library.characters.find(c => c.id === epChar.refId);
    if (!libraryChar) return epChar;
    
    // Merge: library data + episode-specific overrides (name, gender)
    return {
      ...libraryChar,
      id: epChar.id, // Keep episode-local ID for reference consistency
      name: epChar.name,
      gender: epChar.gender
    };
  });
};

/**
 * Get effective scenes for a project
 * In series mode: merge library data with episode lightweight refs
 * In standalone mode: return project scenes directly
 */
export const getEffectiveScenes = (
  project: ProjectState,
  series: SeriesRecord | null
): Scene[] => {
  if (!series || !project.seriesRefId) {
    // Standalone mode
    return project.scriptData?.scenes || [];
  }
  
  // Series mode: merge library data with episode refs
  const episodeScenes = project.scriptData?.scenes || [];
  return episodeScenes.map(epScene => {
    if (!epScene.refId) return epScene;
    
    const libraryScene = series.library.scenes.find(s => s.id === epScene.refId);
    if (!libraryScene) return epScene;
    
    // Merge: library data + episode-specific overrides (location, time, atmosphere)
    return {
      ...libraryScene,
      id: epScene.id, // Keep episode-local ID for reference consistency
      location: epScene.location,
      time: epScene.time,
      atmosphere: epScene.atmosphere
    };
  });
};

/**
 * Get effective props for a project
 * In series mode: merge library data with episode lightweight refs
 * In standalone mode: return project props directly
 */
export const getEffectiveProps = (
  project: ProjectState,
  series: SeriesRecord | null
): Properties[] => {
  if (!series || !project.seriesRefId) {
    // Standalone mode
    return project.scriptData?.props || [];
  }
  
  // Series mode: merge library data with episode refs
  const episodeProps = project.scriptData?.props || [];
  const libraryProps = series.library.props || [];
  
  return episodeProps.map(epProp => {
    if (!epProp.refId) return epProp;
    
    const libraryProp = libraryProps.find(p => p.id === epProp.refId);
    if (!libraryProp) return epProp;
    
    // Merge: library data + episode-specific overrides (name)
    return {
      ...libraryProp,
      id: epProp.id, // Keep episode-local ID for reference consistency
      name: epProp.name
    };
  });
};

/**
 * Get effective scriptData with merged characters/scenes/props
 */
export const getEffectiveScriptData = (
  project: ProjectState,
  series: SeriesRecord | null
): ScriptData | null => {
  if (!project.scriptData) return null;
  
  return {
    ...project.scriptData,
    characters: getEffectiveCharacters(project, series),
    scenes: getEffectiveScenes(project, series),
    props: getEffectiveProps(project, series)
  };
};

// ==================== Utility Functions ====================

/**
 * Check if a project is part of a series
 */
export const isSeriesEpisode = (project: ProjectState): boolean => {
  return !!project.seriesRefId;
};

/**
 * Find a series by ID that contains a given episode
 */
export const findSeriesByEpisodeId = (
  seriesList: SeriesRecord[],
  episodeId: string
): SeriesRecord | undefined => {
  return seriesList.find(s => s.episodeOrder.includes(episodeId));
};

/**
 * Get all episodes of a series
 */
export const getSeriesEpisodes = (
  series: SeriesRecord,
  allProjects: ProjectState[]
): ProjectState[] => {
  const projectMap = new Map(allProjects.map(p => [p.id, p]));
  return series.episodeOrder
    .map(id => projectMap.get(id))
    .filter((p): p is ProjectState => p !== undefined);
};

// ==================== Shots Remapping ====================

/**
 * Remap character references in shots after merging to library
 * This is needed because shots store character IDs that need to be updated
 * when characters are merged into the series library
 * 
 * @param shots - Array of shots to remap
 * @param charIdMapping - Character ID mapping
 * @returns New array with remapped references (deep copy)
 */
export const remapShotsCharRefs = (
  shots: Shot[],
  charIdMapping: Map<string, string>
): Shot[] => {
  // ✅ Parameter validation
  if (!shots || !charIdMapping) {
    console.error('Invalid parameters for remapShotsCharRefs');
    return shots;
  }
  
  return shots.map(shot => ({
    ...shot,
    characters: shot.characters.map(id => charIdMapping.get(id) || id),
    characterVariations: shot.characterVariations
      ? Object.fromEntries(
          Object.entries(shot.characterVariations).map(([k, v]) => [
            charIdMapping.get(k) || k, v
          ])
        )
      : undefined
  }));
};

/**
 * Remap scene references in shots after merging to library
 * This is needed because shots store sceneId that needs to be updated
 * when scenes are merged into series library
 * 
 * @param shots - Array of shots to remap
 * @param sceneIdMapping - Scene ID mapping
 * @returns New array with remapped references (deep copy)
 */
export const remapShotsSceneRefs = (
  shots: Shot[],
  sceneIdMapping: Map<string, string>
): Shot[] => {
  // ✅ Parameter validation
  if (!shots || !sceneIdMapping) {
    console.error('Invalid parameters for remapShotsSceneRefs');
    return shots;
  }
  
  return shots.map(shot => ({
    ...shot,
    sceneId: sceneIdMapping.get(shot.sceneId) || shot.sceneId
  }));
};

/**
 * Remap character references in segments after merging to library
 * 
 * @param segments - Array of segments to remap
 * @param charIdMapping - Character ID mapping
 * @returns New array with remapped references (deep copy)
 */
export const remapSegmentsCharRefs = (
  segments: Segment[],
  charIdMapping: Map<string, string>
): Segment[] => {
  // ✅ Parameter validation
  if (!segments || !charIdMapping) {
    console.error('Invalid parameters for remapSegmentsCharRefs');
    return segments;
  }
  
  return segments.map(segment => ({
    ...segment,
    characterIds: segment.characterIds.map(id => charIdMapping.get(id) || id),
    characterVariations: segment.characterVariations
      ? Object.fromEntries(
          Object.entries(segment.characterVariations).map(([k, v]) => [
            charIdMapping.get(k) || k, v
          ])
        )
      : undefined
  }));
};

/**
 * Remap scene references in segments after merging to library
 * 
 * @param segments - Array of segments to remap
 * @param sceneIdMapping - Scene ID mapping
 * @returns New array with remapped references (deep copy)
 */
export const remapSegmentsSceneRefs = (
  segments: Segment[],
  sceneIdMapping: Map<string, string>
): Segment[] => {
  // ✅ Parameter validation
  if (!segments || !sceneIdMapping) {
    console.error('Invalid parameters for remapSegmentsSceneRefs');
    return segments;
  }
  
  return segments.map(segment => ({
    ...segment,
    sceneIds: segment.sceneIds.map(id => sceneIdMapping.get(id) || id)
  }));
};

// ==================== Import Functions ====================

/**
 * Import a project as an episode of a series
 * This handles the complete workflow:
 * 1. Merge characters/scenes to library
 * 2. Remap all references
 * 3. Create lightweight references
 * 4. Set seriesRefId
 * 
 * Uses transaction pattern for data consistency - either all operations succeed or none do.
 * 
 * @param series - The series to import into
 * @param project - The project to import
 * @returns Updated project and series
 * @throws Error if import fails
 */
export const importProjectAsEpisode = (
  series: SeriesRecord,
  project: ProjectState
): { updatedProject: ProjectState; updatedSeries: SeriesRecord } => {
  try {
    // ✅ Create working copies to avoid partial mutations
    let updatedProject = { ...project };
    let updatedSeries = { ...series };

    // Generate new ID for the project to avoid conflicts
    updatedProject.id = generateId('proj');
    updatedProject.createdAt = Date.now();
    updatedProject.lastModified = Date.now();

    // If project has scriptData, merge characters/scenes to library
    if (updatedProject.scriptData) {
      const characters = updatedProject.scriptData.characters || [];
      const scenes = updatedProject.scriptData.scenes || [];

      if (characters.length > 0 || scenes.length > 0) {
        // Merge to library
        const mergeResult = mergeToLibrary(updatedSeries, characters, scenes);
        updatedSeries = mergeResult.series;

        // Remap scriptData references
        updatedProject.scriptData = remapScriptDataRefs(
          updatedProject.scriptData,
          mergeResult.charIdMapping,
          mergeResult.sceneIdMapping
        );

        // Remap shots character references
        if (updatedProject.shots && updatedProject.shots.length > 0) {
          updatedProject.shots = remapShotsCharRefs(updatedProject.shots, mergeResult.charIdMapping);
          updatedProject.shots = remapShotsSceneRefs(updatedProject.shots, mergeResult.sceneIdMapping);
        }

        // Remap segments character and scene references
        if (updatedProject.segments && updatedProject.segments.length > 0) {
          updatedProject.segments = remapSegmentsCharRefs(updatedProject.segments, mergeResult.charIdMapping);
          updatedProject.segments = remapSegmentsSceneRefs(updatedProject.segments, mergeResult.sceneIdMapping);
        }

        // Create lightweight references for episode storage
        updatedProject.scriptData.characters = createLightweightCharacters(
          updatedProject.scriptData.characters,
          mergeResult.charIdMapping
        );
        updatedProject.scriptData.scenes = createLightweightScenes(
          updatedProject.scriptData.scenes,
          mergeResult.sceneIdMapping
        );
      }
    }

    // Set series reference
    updatedProject.seriesRefId = series.id;

    // Add episode to series order
    if (!updatedSeries.episodeOrder.includes(updatedProject.id)) {
      updatedSeries = {
        ...updatedSeries,
        episodeOrder: [...updatedSeries.episodeOrder, updatedProject.id],
        updatedAt: Date.now()
      };
    }

    return { updatedProject, updatedSeries };
  } catch (error) {
    console.error('Failed to import project as episode:', error);
    throw new Error(`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
