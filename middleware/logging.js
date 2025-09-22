const { companyLogger, ACTIONS, RESOURCES } = require('../services/companyLogger');

/**
 * Middleware to log API requests and responses
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  const originalSend = res.send;

  // Override res.send to capture response
  res.send = function(data) {
    const duration = Date.now() - startTime;
    
    // Log the request after response is sent
    setImmediate(async () => {
      try {
        const companyId = req.user?.companyId || req.companyId;
        const companyName = req.user?.companyName || req.companyName;
        const userId = req.user?.userId || req.user?.id;

        if (companyId && userId) {
          const statusCode = res.statusCode;
          const level = statusCode >= 400 ? 'ERROR' : statusCode >= 300 ? 'WARN' : 'INFO';
          
          const details = {
            method: req.method,
            url: req.originalUrl,
            statusCode: statusCode,
            duration: `${duration}ms`,
            contentLength: res.get('content-length') || 0,
            userAgent: req.get('user-agent'),
            ip: req.ip
          };

          const message = `${req.method} ${req.originalUrl} - ${statusCode} (${duration}ms)`;

          if (level === 'ERROR') {
            await companyLogger.error(
              companyId,
              companyName,
              userId,
              ACTIONS.API_CALL,
              RESOURCES.SYSTEM,
              req.originalUrl,
              message,
              null,
              details,
              req
            );
          } else if (level === 'WARN') {
            await companyLogger.warn(
              companyId,
              companyName,
              userId,
              ACTIONS.API_CALL,
              RESOURCES.SYSTEM,
              req.originalUrl,
              message,
              details,
              req
            );
          } else {
            await companyLogger.info(
              companyId,
              companyName,
              userId,
              ACTIONS.API_CALL,
              RESOURCES.SYSTEM,
              req.originalUrl,
              message,
              details,
              req
            );
          }
        }
      } catch (error) {
        console.error('❌ Error in request logger:', error);
      }
    });

    // Call original send
    originalSend.call(this, data);
  };

  next();
};

/**
 * Middleware to log errors
 */
const errorLogger = (error, req, res, next) => {
  const companyId = req.user?.companyId || req.companyId;
  const companyName = req.user?.companyName || req.companyName;
  const userId = req.user?.userId || req.user?.id;

  if (companyId && userId) {
    setImmediate(async () => {
      try {
        await companyLogger.error(
          companyId,
          companyName,
          userId,
          ACTIONS.ERROR_OCCURRED,
          RESOURCES.SYSTEM,
          req.originalUrl,
          `Error in ${req.method} ${req.originalUrl}: ${error.message}`,
          error,
          {
            method: req.method,
            url: req.originalUrl,
            stack: error.stack,
            body: req.body,
            query: req.query,
            params: req.params
          },
          req
        );
      } catch (logError) {
        console.error('❌ Error logging error:', logError);
      }
    });
  }

  next(error);
};

/**
 * Helper function to log company operations
 */
const logCompanyOperation = async (req, action, resource, resourceId, message, details = {}, level = 'INFO') => {
  try {
    const companyId = req.user?.companyId || req.companyId;
    const companyName = req.user?.companyName || req.companyName;
    const userId = req.user?.userId || req.user?.id;

    if (!companyId || !userId) {
      console.warn('⚠️ Cannot log operation: missing companyId or userId');
      return false;
    }

    const logFunction = companyLogger[level.toLowerCase()];
    if (!logFunction) {
      console.error('❌ Invalid log level:', level);
      return false;
    }

    return await logFunction(
      companyId,
      companyName,
      userId,
      action,
      resource,
      resourceId,
      message,
      details,
      req
    );
  } catch (error) {
    console.error('❌ Error logging company operation:', error);
    return false;
  }
};

module.exports = {
  requestLogger,
  errorLogger,
  logCompanyOperation
};
