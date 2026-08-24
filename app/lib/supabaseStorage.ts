import { createClient } from '@supabase/supabase-js';
import { SUPABASE_CONFIG } from '../constants/supabase';

const client = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);

export async function uploadImage(
  file: Blob | File,
  folder: 'messages' | 'stories' | 'avatars',
  fileName: string,
) {
  try {
    const { data, error } = await client.storage
      .from('media')
      .upload(`${folder}/${fileName}`, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.warn('Upload error:', error);
      return { success: false, error: error.message, url: null };
    }

    // Generate public URL
    const { data: publicData } = client.storage.from('media').getPublicUrl(`${folder}/${fileName}`);

    return {
      success: true,
      error: null,
      url: publicData.publicUrl,
    };
  } catch (err) {
    console.warn('Storage error:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Upload failed',
      url: null,
    };
  }
}

export async function deleteMedia(path: string) {
  try {
    const { error } = await client.storage.from('media').remove([path]);

    if (error) {
      console.warn('Delete error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, error: null };
  } catch (err) {
    console.warn('Delete failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Delete failed',
    };
  }
}

export function getPublicURL(folder: string, fileName: string): string {
  try {
    const { data } = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey)
      .storage.from('media')
      .getPublicUrl(`${folder}/${fileName}`);
    return data.publicUrl;
  } catch {
    return '';
  }
}
