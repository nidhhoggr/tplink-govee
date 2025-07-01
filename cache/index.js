import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { getDirnameFromFile } from '../tplink/src/utils/index.js';

export default class CacheManager {
  constructor(options = {}) {
    //because we cant call __dirname in json
    
    let cacheFile;
    
    if (options.cacheFile) {
      const thisDir = getDirnameFromFile(import.meta.url);
      cacheFile = path.join(thisDir, options.cacheFile);
      if (options.clearCache) {
        this.clearCache();
      }
    }

    delete options.cacheFile;
    
    this.config = {
      cacheFile,
      cacheTtlMs: 3600000, // 1 hour
      ...options
    };

    console.log({options, cacheFile, config: this.config});
  }

  async #readCache() {
    try {
      const data = await fs.promises.readFile(this.config.cacheFile, 'utf8');
      const cache = JSON.parse(data);
      
      if (cache.timestamp && (Date.now() - cache.timestamp) > this.config.cacheTtlMs) {
        return { valid: false, data: {} };
      }
      
      return { valid: true, data: cache.results || {} };
    } catch (error) {
      return { valid: false, data: {} };
    }
  }

  async #writeCache(results) {
    const cacheData = {
      timestamp: Date.now(),
      results
    };
    
    await fs.promises.writeFile(
      this.config.cacheFile, 
      JSON.stringify(cacheData, null, 2)
    );
  }

  async accessFromCache(fn, useCache = true) {
    if (useCache) {
      const cache = await this.#readCache();
      if (cache.valid) {
        console.log('Using cached results');
        return cache.data;
      }
    }

    const results = await fn;
    
    if (Object.keys(results).length > 0) {
      await this.#writeCache(results);
    }

    return results;
  }

  async clearCache() {
    try {
      await fs.promises.unlink(this.config.cacheFile);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return true; // File doesn't exist, consider cache cleared
      }
      throw error;
    }
  }
}
