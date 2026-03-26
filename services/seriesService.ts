import { Character, ProjectState, Scene, ScriptData, SeriesRecord, Shot } from '../types';

// ==================== Series Creation ====================

export const createNewSeries = (title: string, options?: {
  rawScript?: string;
  targetDuration?: string;
  language?: string;
  visualStyle?: string;
  genre?: string;
  imageSize?: string;
  imageCount?: number;
}): SeriesRecord => {
  const id = 'series_' + Date.now().toString(36);
  return {
    id,
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
      scenes: []
    },
    episodeOrder: [],
    version: 1
  };
};
/**
 * Create a new episode for a series
 */
export const createSeriesEpisode = (series: SeriesRecord): ProjectState => {
  return {
    id: 'proj_' + Date.now().toString(36),
    title: `${series.title} - 第${series.episodeOrder.length + 1}集`,
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
    imageCount: series.imageCount ?? 1,
    scriptData: null,
    isParsingScript: false,
    rawScript: series.rawScript || `标题：示例剧本`
  };
};

// ==================== ID Mapping ====================

export interface MergeResult {
  series: SeriesRecord;
  charIdMapping: Map<string, string>; // originalId -> libraryId
  sceneIdMapping: Map<string, string>; // originalId -> libraryId
}

// ==================== Library Merge Functions ====================

/**
 * Merge characters into series library
 * Returns a map of original IDs to library IDs
 */
export const mergeCharactersToLibrary = (
  series: SeriesRecord,
  characters: Character[]
): { updatedSeries: SeriesRecord; charIdMapping: Map<string, string> } => {
  const charIdMapping = new Map<string, string>();
  const newLibrary = { ...series.library };
  
  characters.forEach(char => {
    // Check if character already exists in library (by name and gender)
    const existingIndex = newLibrary.characters.findIndex(
      c => c.name === char.name && c.gender === char.gender
    );
    
    if (existingIndex >= 0) {
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
        variations: char.variations?.length ? char.variations : existingChar.variations,
        ttsParams: char.ttsParams || existingChar.ttsParams,
        voiceUrl: char.voiceUrl || existingChar.voiceUrl
      };
    } else {
      // Add new character to library
      const libraryCharId = `char_lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
 */
export const mergeScenesToLibrary = (
  series: SeriesRecord,
  scenes: Scene[]
): { updatedSeries: SeriesRecord; sceneIdMapping: Map<string, string> } => {
  const sceneIdMapping = new Map<string, string>();
  const newLibrary = { ...series.library };
  
  scenes.forEach(scene => {
    // Check if scene already exists in library (by location and time)
    const existingIndex = newLibrary.scenes.findIndex(
      s => s.location === scene.location && s.time === scene.time
    );
    
    if (existingIndex >= 0) {
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
      const librarySceneId = `scene_lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
 * Merge both characters and scenes to library in one operation
 */
export const mergeToLibrary = (
  series: SeriesRecord,
  characters: Character[],
  scenes: Scene[]
): MergeResult => {
  // First merge characters
  const charResult = mergeCharactersToLibrary(series, characters);
  // Then merge scenes (using the updated series from charResult)
  const sceneResult = mergeScenesToLibrary(charResult.updatedSeries, scenes);
  
  return {
    series: sceneResult.updatedSeries,
    charIdMapping: charResult.charIdMapping,
    sceneIdMapping: sceneResult.sceneIdMapping
  };
};

// ==================== Script Data Remapping ====================

/**
 * Remap all character/scene references in scriptData after merging to library
 */
export const remapScriptDataRefs = (
  scriptData: ScriptData,
  charIdMapping: Map<string, string>,
  sceneIdMapping: Map<string, string>
): ScriptData => {
  const newScriptData = { ...scriptData };
  
  // Remap characters
  if (newScriptData.characters) {
    newScriptData.characters = newScriptData.characters.map(char => ({
      ...char,
      id: charIdMapping.get(char.id) || char.id
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
    scenes: series.library.scenes.filter(s => s.id !== sceneId)
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
 * Get effective scriptData with merged characters/scenes
 */
export const getEffectiveScriptData = (
  project: ProjectState,
  series: SeriesRecord | null
): ScriptData | null => {
  if (!project.scriptData) return null;
  
  return {
    ...project.scriptData,
    characters: getEffectiveCharacters(project, series),
    scenes: getEffectiveScenes(project, series)
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
 */
export const remapShotsCharRefs = (
  shots: Shot[],
  charIdMapping: Map<string, string>
): Shot[] => {
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
 */
export const remapShotsSceneRefs = (
  shots: Shot[],
  sceneIdMapping: Map<string, string>
): Shot[] => {
  return shots.map(shot => ({
    ...shot,
    sceneId: sceneIdMapping.get(shot.sceneId) || shot.sceneId
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
 * Returns the updated project and series
 */
export const importProjectAsEpisode = (
  series: SeriesRecord,
  project: ProjectState
): { updatedProject: ProjectState; updatedSeries: SeriesRecord } => {
  let updatedProject = { ...project };
  let updatedSeries = { ...series };

  // Generate new ID for the project to avoid conflicts
  updatedProject.id = 'proj_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
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
};
