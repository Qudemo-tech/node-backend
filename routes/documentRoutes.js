const express = require('express');
const router = express.Router();
const { DocumentController, upload } = require('../controllers/documentController');
const { authenticateToken } = require('../middleware/auth');

const documentController = new DocumentController();

// Upload document to QuDemo
router.post('/:qudemoId/upload', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    await documentController.uploadDocument(req, res);
  } catch (error) {
    console.error('❌ Document upload error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Get documents for a QuDemo
router.get('/:qudemoId/documents', authenticateToken, async (req, res) => {
  try {
    await documentController.getDocuments(req, res);
  } catch (error) {
    console.error('❌ Get documents error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Delete document
router.delete('/:documentId', authenticateToken, async (req, res) => {
  try {
    await documentController.deleteDocument(req, res);
  } catch (error) {
    console.error('❌ Delete document error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

// Handle document processing completion notification from Python backend
router.post('/:documentId/processing-complete', async (req, res) => {
  try {
    await documentController.handleDocumentProcessingComplete(req, res);
  } catch (error) {
    console.error('❌ Document processing completion error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
});

module.exports = router;
