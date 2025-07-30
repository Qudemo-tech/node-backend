const validate = (schema) => {
  return (req, res, next) => {
    
    const { error } = schema.validate(req.body);
    if (error) {
      console.log('❌ Validation failed:', error.details);
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    console.log('✅ Validation passed');
    next();
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    
    const { error } = schema.validate(req.query);
    if (error) {
      console.log('❌ Query validation failed:', error.details);
      return res.status(400).json({
        error: 'Query validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    console.log('✅ Query validation passed');
    next();
  };
};

const validateParams = (schema) => {
  return (req, res, next) => {
    
    const { error } = schema.validate(req.params);
    if (error) {
      console.log('❌ Parameter validation failed:', error.details);
      return res.status(400).json({
        error: 'Parameter validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    console.log('✅ Parameter validation passed');
    next();
  };
};

const validateRequest = (schema, property = 'body') => {
  return (req, res, next) => {
    
    const { error } = schema.validate(req[property]);
    if (error) {
      console.log('❌ Request validation failed:', error.details);
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message),
        receivedData: req[property]
      });
    }
    console.log('✅ Request validation passed');
    next();
  };
};

module.exports = {
  validate,
  validateQuery,
  validateParams,
  validateRequest
}; 