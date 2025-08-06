const express = require('express');
const router = express.Router();
const potokenController = require('../controllers/potokenController');

// Health check for PoToken service
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'potoken-service',
        nodeAvailable: potokenController.isYtDlpAvailable,
        timestamp: new Date().toISOString()
    });
});

// VM health check endpoint
router.get('/vm-health', async (req, res) => {
    try {
        console.log('🔍 VM health check requested');
        const vmHealth = await potokenController.checkVMHealth();
        
        res.json({
            success: true,
            vmHealthy: vmHealth,
            timestamp: new Date().toISOString(),
            message: vmHealth ? 'VM is healthy and ready' : 'VM health check failed'
        });
    } catch (error) {
        console.error('❌ VM health check error:', error);
        res.status(500).json({
            success: false,
            vmHealthy: false,
            error: error.message
        });
    }
});

// Test VM download endpoint
router.post('/test-vm-download', async (req, res) => {
    try {
        const { videoUrl } = req.body;
        
        if (!videoUrl) {
            return res.status(400).json({
                success: false,
                error: 'videoUrl is required'
            });
        }

        console.log(`🧪 VM download test requested for: ${videoUrl}`);
        
        // Generate a unique output path
        const path = require('path');
        const outputPath = path.join(__dirname, '..', '..', '..', 'test_vm_download_' + Date.now() + '.mp4');
        
        const startTime = Date.now();
        const result = await potokenController.downloadWithGCPVM(videoUrl, outputPath);
        const endTime = Date.now();
        
        res.json({
            success: true,
            data: {
                ...result,
                duration: (endTime - startTime) / 1000,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ VM download test error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Generate PoToken for a video URL
router.post('/generate', async (req, res) => {
    try {
        const { videoUrl } = req.body;
        
        if (!videoUrl) {
            return res.status(400).json({
                success: false,
                error: 'videoUrl is required'
            });
        }

        // Validate YouTube URL
        if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
            return res.status(400).json({
                success: false,
                error: 'Only YouTube URLs are supported for PoToken generation'
            });
        }

        console.log(`🔐 PoToken generation requested for: ${videoUrl}`);
        
        // Use direct video info extraction to avoid recursion
        const result = await potokenController.getVideoInfoWithPoToken(videoUrl);
        
        res.json(result);
        
    } catch (error) {
        console.error('❌ PoToken generation error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Get video info with PoToken
router.get('/info', async (req, res) => {
    try {
        const { videoUrl } = req.query;
        
        if (!videoUrl) {
            return res.status(400).json({
                success: false,
                error: 'videoUrl query parameter is required'
            });
        }

        const result = await potokenController.getVideoInfoWithPoToken(videoUrl);
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(500).json(result);
        }
        
    } catch (error) {
        console.error('❌ Video info error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Download video with PoToken
router.post('/download', async (req, res) => {
    try {
        const { videoUrl, outputPath } = req.body;
        
        console.log(`📥 PoToken download request received:`, { videoUrl, outputPath });
        
        if (!videoUrl) {
            console.error('❌ Missing videoUrl in request');
            return res.status(400).json({
                success: false,
                error: 'videoUrl is required'
            });
        }

        if (!outputPath) {
            console.error('❌ Missing outputPath in request');
            return res.status(400).json({
                success: false,
                error: 'outputPath is required'
            });
        }

        // Validate YouTube URL
        if (!videoUrl.includes('youtube.com') && !videoUrl.includes('youtu.be')) {
            console.error('❌ Non-YouTube URL provided:', videoUrl);
            return res.status(400).json({
                success: false,
                error: 'Only YouTube URLs are supported for PoToken download'
            });
        }

        console.log(`🚀 Starting PoToken download: ${videoUrl} -> ${outputPath}`);
        
        // Check if yt-dlp is available
        if (!potokenController.isYtDlpAvailable) {
            console.error('❌ yt-dlp not available for download');
            return res.status(503).json({
                success: false,
                error: 'yt-dlp not available. Please try again in a moment.'
            });
        }
        
        const result = await potokenController.downloadWithPoToken(videoUrl, outputPath);
        
        console.log(`✅ PoToken download successful:`, result);
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('❌ PoToken download error:', error);
        console.error('❌ Error stack:', error.stack);
        
        res.status(500).json({
            success: false,
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
});

// Test endpoint for PoToken functionality
router.get('/test', async (req, res) => {
    try {
        const testUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'; // Rick Roll for testing
        
        console.log('🧪 Testing PoToken functionality...');
        
        const result = await potokenController.getVideoInfoWithPoToken(testUrl);
        
        res.json({
            success: true,
            test: 'PoToken functionality test',
            result: result,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ PoToken test error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            test: 'PoToken functionality test failed'
        });
    }
});

module.exports = router; 