const { createClient } = require('@supabase/supabase-js');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const fsPromises = require('fs').promises;

// Create Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, PPT, PPTX, and TXT files are allowed.'), false);
    }
  }
});

class DocumentController {
  constructor() {
    // GCS operations will be handled by Python backend
  }

  // Upload document to QuDemo
  async uploadDocument(req, res) {
    try {
      const { qudemoId } = req.params;
      const { companyName, company_name } = req.body;
      const file = req.file;
      
      // Handle both companyName and company_name for compatibility
      const finalCompanyName = companyName || company_name;

      if (!file) {
        return res.status(400).json({
          success: false,
          error: 'No file provided'
        });
      }

      console.log(`📄 Uploading document: ${file.originalname} for QuDemo: ${qudemoId}, Company: ${finalCompanyName}`);

      // Verify QuDemo exists and user has access
      const { data: qudemo, error: qudemoError } = await supabase
        .from('qudemos_new')
        .select('id, title, company_id, companies!inner(name)')
        .eq('id', qudemoId)
        .single();

      if (qudemoError || !qudemo) {
        return res.status(404).json({
          success: false,
          error: 'QuDemo not found'
        });
      }

      // Create document record in database
      const { data: document, error: docError } = await supabase
        .from('qudemo_documents')
        .insert({
          qudemo_id: qudemoId,
          filename: file.originalname,
          file_type: file.mimetype,
          file_size: file.size,
          upload_status: 'pending'
        })
        .select()
        .single();

      if (docError) {
        console.error('❌ Error creating document record:', docError);
        return res.status(500).json({
          success: false,
          error: 'Failed to create document record'
        });
      }

      // Store file temporarily in uploads directory
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        await fsPromises.mkdir(uploadsDir, { recursive: true });
      }
      
      const fileName = `${document.id}_${file.originalname}`;
      const filePath = path.join(uploadsDir, fileName);
      
      try {
        await fsPromises.writeFile(filePath, file.buffer);
      } catch (writeError) {
        // Clean up database record if file write fails
        await supabase
          .from('qudemo_documents')
          .delete()
          .eq('id', document.id);
        
        return res.status(500).json({
          success: false,
          error: 'Failed to store file temporarily'
        });
      }

      // Update document record with file path
      await supabase
        .from('qudemo_documents')
        .update({
          file_path: filePath,
          upload_status: 'processing'
        })
        .eq('id', document.id);

      // Queue document processing
      await this.queueDocumentProcessing(finalCompanyName, qudemoId, document.id, filePath, file.mimetype);

      console.log(`✅ Document uploaded successfully: ${file.originalname}`);

      res.json({
        success: true,
        document: {
          id: document.id,
          filename: file.originalname,
          file_type: file.mimetype,
          file_size: file.size,
          upload_status: 'processing'
        }
      });

    } catch (error) {
      console.error('❌ Error uploading document:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Queue document for processing
  async queueDocumentProcessing(companyName, qudemoId, documentId, filePath, mimeType) {
    try {
      console.log(`🔄 Queuing document processing for: ${documentId}`);
      
      // Read the file and send it to Python backend
      const fileBuffer = await fsPromises.readFile(filePath);
      const fileName = path.basename(filePath);
      
      // Call Python backend to process document
      const pythonApiUrl = process.env.PYTHON_API_BASE_URL || 'http://localhost:5001';
      console.log(`🔗 Environment PYTHON_API_BASE_URL: ${process.env.PYTHON_API_BASE_URL}`);
      console.log(`🔗 Using Python API URL: ${pythonApiUrl}`);
      console.log(`🔗 Full endpoint URL: ${pythonApiUrl}/process-document`);
      
      const fetch = (await import('node-fetch')).default;
      const FormData = (await import('form-data')).default;
      
      const formData = new FormData();
      formData.append('file', fileBuffer, {
        filename: fileName,
        contentType: mimeType
      });
      formData.append('company_name', companyName);
      formData.append('qudemo_id', qudemoId);
      formData.append('document_id', documentId);
      formData.append('mime_type', mimeType);
      
      const response = await fetch(`${pythonApiUrl}/process-document`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        console.log(`✅ Document processing queued successfully: ${documentId}`);
        
        // Update document status to processing (not completed yet)
        await supabase
          .from('qudemo_documents')
          .update({ upload_status: 'processing' })
          .eq('id', documentId);
        
        console.log(`✅ Document status updated to processing: ${documentId}`);
        
        // Clean up temporary file
        try {
          await fsPromises.unlink(filePath);
        } catch (unlinkError) {
          console.warn(`⚠️ Failed to delete temporary file: ${filePath}`);
        }
      } else {
        const errorText = await response.text();
        console.log(`⚠️ Failed to queue document processing: ${documentId}`, errorText);
        // Update status to failed
        await supabase
          .from('qudemo_documents')
          .update({ upload_status: 'failed' })
          .eq('id', documentId);
      }
    } catch (error) {
      console.error(`❌ Error queuing document processing: ${error.message}`);
      console.error(`❌ Error details:`, error);
      // Update status to failed
      await supabase
        .from('qudemo_documents')
        .update({ upload_status: 'failed' })
        .eq('id', documentId);
    }
  }

  // Get documents for a QuDemo
  async getDocuments(req, res) {
    try {
      const { qudemoId } = req.params;

      const { data: documents, error } = await supabase
        .from('qudemo_documents')
        .select('*')
        .eq('qudemo_id', qudemoId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error fetching documents:', error);
        return res.status(500).json({
          success: false,
          error: 'Failed to fetch documents'
        });
      }

      res.json({
        success: true,
        documents: documents || []
      });

    } catch (error) {
      console.error('❌ Error getting documents:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Delete document
  async deleteDocument(req, res) {
    try {
      const { documentId } = req.params;

      // Get document info
      const { data: document, error: docError } = await supabase
        .from('qudemo_documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !document) {
        return res.status(404).json({
          success: false,
          error: 'Document not found'
        });
      }

      // Delete temporary file if it exists
      if (document.file_path && document.file_path.startsWith('/')) {
        try {
          await fsPromises.unlink(document.file_path);
        } catch (unlinkError) {
          console.warn(`⚠️ Failed to delete file: ${document.file_path}`);
        }
      }

      // Delete from database
      const { error: deleteError } = await supabase
        .from('qudemo_documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        console.error('❌ Error deleting document:', deleteError);
        return res.status(500).json({
          success: false,
          error: 'Failed to delete document'
        });
      }

      console.log(`✅ Document deleted successfully: ${document.filename}`);

      res.json({
        success: true,
        message: 'Document deleted successfully'
      });

    } catch (error) {
      console.error('❌ Error deleting document:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  // Handle document processing completion notification from Python backend
  async handleDocumentProcessingComplete(req, res) {
    try {
      const { documentId } = req.params;
      const { success, error: processingError } = req.body;

      console.log(`🔔 Received document processing completion for: ${documentId}`);
      console.log(`📊 Processing result: success=${success}`);

      if (success) {
        // Update document status to completed
        const { error: updateError } = await supabase
          .from('qudemo_documents')
          .update({ 
            upload_status: 'completed',
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId);

        if (updateError) {
          console.error(`❌ Error updating document status:`, updateError);
          return res.status(500).json({
            success: false,
            error: 'Failed to update document status'
          });
        }

        // Verify the update worked
        const { data: updatedDoc, error: verifyError } = await supabase
          .from('qudemo_documents')
          .select('id, filename, upload_status')
          .eq('id', documentId)
          .single();
          
        if (!verifyError && updatedDoc) {
          console.log(`✅ Document status verified: ${updatedDoc.filename} -> ${updatedDoc.upload_status}`);
        } else {
          console.error(`❌ Failed to verify document status update:`, verifyError);
        }
      } else {
        // Update document status to failed
        const { error: updateError } = await supabase
          .from('qudemo_documents')
          .update({ 
            upload_status: 'failed',
            updated_at: new Date().toISOString()
          })
          .eq('id', documentId);

        if (updateError) {
          console.error(`❌ Error updating document status:`, updateError);
          return res.status(500).json({
            success: false,
            error: 'Failed to update document status'
          });
        }

        console.log(`❌ Document status updated to failed: ${documentId}`);
      }

      res.json({
        success: true,
        message: 'Document processing completion handled'
      });

    } catch (error) {
      console.error('❌ Error handling document processing completion:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }
}

module.exports = {
  DocumentController,
  upload
};
