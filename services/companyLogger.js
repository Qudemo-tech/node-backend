const { createClient } = require('@supabase/supabase-js');

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Action types
const ACTIONS = {
  // Company management
  CREATE_COMPANY: 'CREATE_COMPANY',
  UPDATE_COMPANY: 'UPDATE_COMPANY',
  DELETE_COMPANY: 'DELETE_COMPANY',
  UPLOAD_LOGO: 'UPLOAD_LOGO',
  
  // QuDemo operations
  CREATE_QUDEMO: 'CREATE_QUDEMO',
  UPDATE_QUDEMO: 'UPDATE_QUDEMO',
  DELETE_QUDEMO: 'DELETE_QUDEMO',
  SHARE_QUDEMO: 'SHARE_QUDEMO',
  
  // Video operations
  UPLOAD_VIDEO: 'UPLOAD_VIDEO',
  PROCESS_VIDEO: 'PROCESS_VIDEO',
  DELETE_VIDEO: 'DELETE_VIDEO',
  
  // Knowledge management
  CREATE_KNOWLEDGE: 'CREATE_KNOWLEDGE',
  UPDATE_KNOWLEDGE: 'UPDATE_KNOWLEDGE',
  DELETE_KNOWLEDGE: 'DELETE_KNOWLEDGE',
  PROCESS_DOCUMENT: 'PROCESS_DOCUMENT',
  
  // User operations
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_REGISTER: 'USER_REGISTER',
  
  // System operations
  API_CALL: 'API_CALL',
  ERROR_OCCURRED: 'ERROR_OCCURRED',
  PERFORMANCE_METRIC: 'PERFORMANCE_METRIC'
};

// Resource types
const RESOURCES = {
  COMPANY: 'company',
  QUDEMO: 'qudemo',
  VIDEO: 'video',
  KNOWLEDGE: 'knowledge',
  USER: 'user',
  SYSTEM: 'system'
};

class CompanyLogger {
  constructor() {
    this.bucketName = 'company-logs';
    this.currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
  }

  /**
   * Generate log entry
   */
  generateLogEntry(level, companyId, companyName, userId, action, resource, resourceId, message, details = {}, error = null, req = null) {
    const timestamp = new Date().toISOString();
    const requestId = req?.headers['x-request-id'] || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    return {
      timestamp,
      level,
      companyId,
      companyName,
      userId,
      action,
      resource,
      resourceId,
      message,
      details,
      error: error ? {
        message: error.message,
        stack: error.stack,
        code: error.code || 'UNKNOWN_ERROR'
      } : null,
      ipAddress: req?.ip || req?.connection?.remoteAddress || 'unknown',
      userAgent: req?.headers['user-agent'] || 'unknown',
      requestId
    };
  }

  /**
   * Format log entry for file storage
   */
  formatLogEntry(logEntry) {
    return JSON.stringify(logEntry) + '\n';
  }

  /**
   * Get log file path for company
   */
  getLogFilePath(companyId, isError = false) {
    const month = new Date().toISOString().slice(0, 7); // YYYY-MM
    const fileName = isError ? `errors-${month}.log` : `logs-${month}.log`;
    return `company-${companyId}/${fileName}`;
  }

  /**
   * Upload log entry to Supabase Storage
   */
  async uploadLogEntry(companyId, logEntry, isError = false) {
    try {
      const filePath = this.getLogFilePath(companyId, isError);
      const logContent = this.formatLogEntry(logEntry);
      
      // Check if file exists
      const { data: existingFile, error: checkError } = await supabase.storage
        .from(this.bucketName)
        .download(filePath);

      let newContent = logContent;
      
      if (existingFile && !checkError) {
        // File exists, append to it
        const existingContent = await existingFile.text();
        newContent = existingContent + logContent;
      }

      // Upload/update the file
      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .upload(filePath, newContent, {
          contentType: 'text/plain',
          upsert: true
        });

      if (error) {
        console.error('❌ Failed to upload log entry:', error);
        return false;
      }

      console.log(`✅ Log entry uploaded: ${filePath}`);
      return true;

    } catch (error) {
      console.error('❌ Error uploading log entry:', error);
      return false;
    }
  }

  /**
   * Log info message
   */
  async info(companyId, companyName, userId, action, resource, resourceId, message, details = {}, req = null) {
    const logEntry = this.generateLogEntry(
      'INFO',
      companyId,
      companyName,
      userId,
      action,
      resource,
      resourceId,
      message,
      details,
      null,
      req
    );
    
    return await this.uploadLogEntry(companyId, logEntry, false);
  }

  /**
   * Log warning message
   */
  async warn(companyId, companyName, userId, action, resource, resourceId, message, details = {}, req = null) {
    const logEntry = this.generateLogEntry(
      'WARN',
      companyId,
      companyName,
      userId,
      action,
      resource,
      resourceId,
      message,
      details,
      null,
      req
    );
    
    return await this.uploadLogEntry(companyId, logEntry, false);
  }

  /**
   * Log error message
   */
  async error(companyId, companyName, userId, action, resource, resourceId, message, error, details = {}, req = null) {
    const logEntry = this.generateLogEntry(
      'ERROR',
      companyId,
      companyName,
      userId,
      action,
      resource,
      resourceId,
      message,
      details,
      error,
      req
    );
    
    // Log to both regular and error files
    await this.uploadLogEntry(companyId, logEntry, false);
    await this.uploadLogEntry(companyId, logEntry, true);
    
    return true;
  }

  /**
   * Log debug message
   */
  async debug(companyId, companyName, userId, action, resource, resourceId, message, details = {}, req = null) {
    const logEntry = this.generateLogEntry(
      'DEBUG',
      companyId,
      companyName,
      userId,
      action,
      resource,
      resourceId,
      message,
      details,
      null,
      req
    );
    
    return await this.uploadLogEntry(companyId, logEntry, false);
  }

  /**
   * Get logs for a company
   */
  async getLogs(companyId, month = null, isError = false) {
    try {
      const targetMonth = month || new Date().toISOString().slice(0, 7);
      const fileName = isError ? `errors-${targetMonth}.log` : `logs-${targetMonth}.log`;
      const filePath = `company-${companyId}/${fileName}`;

      const { data, error } = await supabase.storage
        .from(this.bucketName)
        .download(filePath);

      if (error) {
        console.error('❌ Failed to download logs:', error);
        return null;
      }

      const content = await data.text();
      const logEntries = content.trim().split('\n').map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          return null;
        }
      }).filter(entry => entry !== null);

      return logEntries;

    } catch (error) {
      console.error('❌ Error retrieving logs:', error);
      return null;
    }
  }

  /**
   * Setup Supabase Storage bucket
   */
  async setupStorage() {
    try {
      console.log('🔧 Setting up company logs storage...');
      
      // Check if bucket exists
      const { data: buckets, error: listError } = await supabase.storage.listBuckets();
      
      if (listError) {
        console.error('❌ Error listing buckets:', listError);
        return false;
      }
      
      const logsBucket = buckets.find(bucket => bucket.name === this.bucketName);
      
      if (!logsBucket) {
        console.log('📦 Creating company-logs bucket...');
        
        const { data, error } = await supabase.storage.createBucket(this.bucketName, {
          public: false,
          allowedMimeTypes: ['text/plain', 'application/gzip'],
          fileSizeLimit: 10485760 // 10MB
        });
        
        if (error) {
          console.error('❌ Error creating bucket:', error);
          return false;
        }
        
        console.log('✅ company-logs bucket created successfully');
      } else {
        console.log('✅ company-logs bucket already exists');
      }
      
      return true;
      
    } catch (error) {
      console.error('❌ Storage setup error:', error);
      return false;
    }
  }
}

// Create singleton instance
const companyLogger = new CompanyLogger();

// Bind methods to ensure proper 'this' context
const boundLogger = {
  setupStorage: companyLogger.setupStorage.bind(companyLogger),
  info: companyLogger.info.bind(companyLogger),
  warn: companyLogger.warn.bind(companyLogger),
  error: companyLogger.error.bind(companyLogger),
  debug: companyLogger.debug.bind(companyLogger),
  getLogs: companyLogger.getLogs.bind(companyLogger)
};

module.exports = {
  companyLogger: boundLogger,
  LOG_LEVELS,
  ACTIONS,
  RESOURCES
};
