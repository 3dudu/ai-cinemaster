import { ProjectState } from '../types';

// 获取服务器根地址
function getServerBaseUrl(): string | null {
  return localStorage.getItem('cinegen_file_upload_service_url') || null;
}

// 获取 token
function getToken(): string {
  const uploadServiceUrl = getServerBaseUrl();
  if (!uploadServiceUrl) return '';
  
  try {
    const url = new URL(uploadServiceUrl);
    const token = url.searchParams.get('token');
    return token || '';
  } catch {
    return '';
  }
}

export interface SyncFileInfo {
  fileName: string;
  lastModified: number;
  id?: string;
  title?: string;
  createdAt: number;
}

export interface SyncResult {
  success: boolean;
  message?: string;
  error?: string;
  syncKey?: string;
}

/**
 * 初始化同步 - 上传或检查项目
 */
export async function initSync(syncKey: string): Promise<SyncResult> {
  const uploadServiceUrl = getServerBaseUrl();
  
  if (!uploadServiceUrl) {
    return { success: false, error: '未配置服务器地址' };
  }
  
  const token = getToken();
  const serverUrl = new URL(uploadServiceUrl);
  const baseurl =  `${serverUrl.protocol}//${serverUrl.hostname}${serverUrl.port ? ':' + serverUrl.port : ''}`;
  const url = `${baseurl}/api/sync/init`;
  
  try {
    const response = await fetch(`${url}?syncKey=${encodeURIComponent(syncKey)}&token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return {
      success: (data.code==200 && data.data)? true : false,
      message: data.message || '初始化成功',
      syncKey: data.data || data.syncKey || syncKey
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '初始化失败'
    };
  }
}

/**
 * 获取服务器文件列表
 */
export async function getServerFiles(syncKey: string): Promise<SyncFileInfo[]> {
  const uploadServiceUrl = getServerBaseUrl();
  if (!uploadServiceUrl) {
    throw new Error('未配置服务器地址');
  }

  const token = getToken();
  const serverUrl = new URL(uploadServiceUrl);
  const baseurl =  `${serverUrl.protocol}//${serverUrl.hostname}${serverUrl.port ? ':' + serverUrl.port : ''}`;
  const url = `${baseurl}/api/sync/files`;

  try {
    const response = await fetch(`${url}?token=${encodeURIComponent(token)}&syncKey=${encodeURIComponent(syncKey)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.data || data.files || [];
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '获取文件列表失败');
  }
}

/**
 * 上传项目到服务器
 */
export async function uploadProject(project: ProjectState, syncKey: string): Promise<SyncResult> {
  const uploadServiceUrl = getServerBaseUrl();
  if (!uploadServiceUrl) {
    return { success: false, error: '未配置服务器地址' };
  }

  const fileName = `${project.id}`;
  const token = getToken();
  const serverUrl = new URL(uploadServiceUrl);
  const baseurl =  `${serverUrl.protocol}//${serverUrl.hostname}${serverUrl.port ? ':' + serverUrl.port : ''}`;
  const url = `${baseurl}/api/sync/upload/json`;

  try {
    const response = await fetch(`${url}?token=${encodeURIComponent(token)}&syncKey=${encodeURIComponent(syncKey)}&fileName=${encodeURIComponent(fileName)}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(project),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, message: data.message || '上传成功' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '上传失败'
    };
  }
}

/**
 * 从服务器下载项目
 */
export async function downloadProject(syncKey: string, fileName: string): Promise<ProjectState> {
  const serverUrl = getServerBaseUrl();
  if (!serverUrl) {
    throw new Error('未配置服务器地址');
  }

  const token = getToken();
  const serverUrl2 = new URL(serverUrl);
  const baseurl = `${serverUrl2.protocol}//${serverUrl2.hostname}${serverUrl2.port ? ':' + serverUrl2.port : ''}`;
  const url = `${baseurl}/api/sync/download`;
  
  try {
    const response = await fetch(`${url}?token=${encodeURIComponent(token)}&syncKey=${encodeURIComponent(syncKey)}&fileName=${encodeURIComponent(fileName)}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const result = data.data || data;
    // 如果 result 是字符串，尝试解析为 JSON 对象
    if (typeof result === 'string') {
      return JSON.parse(result);
    }
    return result;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : '下载失败');
  }
}

/**
 * 从服务器删除项目
 */
export async function deleteProject(syncKey: string, fileName: string): Promise<SyncResult> {
  const serverUrl = getServerBaseUrl();
  if (!serverUrl) {
    return { success: false, error: '未配置服务器地址' };
  }

  const token = getToken();
  const serverUrl2 = new URL(serverUrl);
  const baseurl = `${serverUrl2.protocol}//${serverUrl2.hostname}${serverUrl2.port ? ':' + serverUrl2.port : ''}`;
  const url = `${baseurl}/api/sync/delete`;

  try {
    const response = await fetch(`${url}?token=${encodeURIComponent(token)}&syncKey=${encodeURIComponent(syncKey)}&fileName=${encodeURIComponent(fileName)}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, message: data.message || '删除成功' };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除失败'
    };
  }
}
