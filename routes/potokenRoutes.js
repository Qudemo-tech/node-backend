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
        
        const result = await potokenController.generatePoToken(videoUrl);
        
        res.json({
            success: true,
            data: result
        });
        
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
        
        if (!videoUrl) {
            return res.status(400).json({
                success: false,
                error: 'videoUrl is required'
            });
        }

        if (!outputPath) {
            return res.status(400).json({
                success: false,
                error: 'outputPath is required'
            });
        }

        console.log(`📥 PoToken download requested: ${videoUrl} -> ${outputPath}`);
        
        const result = await potokenController.downloadWithPoToken(videoUrl, outputPath);
        
        res.json({
            success: true,
            data: result
        });
        
    } catch (error) {
        console.error('❌ PoToken download error:', error);
        res.status(500).json({
            success: false,
            error: error.message
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