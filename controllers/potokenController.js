const axios = require('axios');
const { spawn } = require('child_process');
const path = require('path');

class PoTokenController {
    constructor() {
        this.isYtDlpAvailable = false;
        this.checkYtDlpAvailability();
    }

    async checkYtDlpAvailability() {
        try {
            const { exec } = require('child_process');
            exec('yt-dlp --version', (error, stdout) => {
                if (!error && stdout) {
                    this.isYtDlpAvailable = true;
                    console.log('✅ yt-dlp available for video processing:', stdout.trim());
                } else {
                    console.warn('⚠️ yt-dlp not available for video processing');
                }
            });
        } catch (error) {
            console.error('❌ Error checking yt-dlp availability:', error);
        }
    }

    async generatePoToken(videoUrl) {
        if (!this.isYtDlpAvailable) {
            throw new Error('yt-dlp not available for video processing');
        }

        try {
            console.log(`🔐 Processing video with yt-dlp: ${videoUrl}`);
            
            // Use yt-dlp for video processing
            const result = await this.runYtDlpWithEnhancedHeaders(videoUrl);
            
            if (result.success) {
                console.log('✅ Video processing successful');
                return {
                    success: true,
                    videoInfo: result.videoInfo,
                    downloadUrl: result.downloadUrl
                };
            } else {
                throw new Error('Failed to process video');
            }
        } catch (error) {
            console.error('❌ Video processing failed:', error);
            throw error;
        }
    }

    async runYtDlpWithEnhancedHeaders(videoUrl) {
        return new Promise((resolve, reject) => {
            const { spawn } = require('child_process');
            
            // Enhanced yt-dlp command with anti-bot headers
            const ytDlpArgs = [
                '--dump-json',
                '--no-warnings',
                '--no-check-certificate',
                '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                '--add-header', 'Accept-Language: en-US,en;q=0.9',
                '--add-header', 'Accept-Encoding: gzip, deflate, br',
                '--add-header', 'DNT: 1',
                '--add-header', 'Connection: keep-alive',
                '--add-header', 'Upgrade-Insecure-Requests: 1',
                videoUrl
            ];
            
            const ytDlpProcess = spawn('yt-dlp', ytDlpArgs);
            
            let stdout = '';
            let stderr = '';
            
            ytDlpProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });
            
            ytDlpProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });
            
            ytDlpProcess.on('close', (code) => {
                if (code === 0 && stdout) {
                    try {
                        const videoData = JSON.parse(stdout);
                        
                        const result = {
                            success: true,
                            videoInfo: {
                                title: videoData.title,
                                duration: videoData.duration,
                                uploader: videoData.uploader,
                                view_count: videoData.view_count,
                                description: videoData.description ? videoData.description.substring(0, 200) + '...' : ''
                            },
                            downloadUrl: videoData.url || videoData.webpage_url,
                            formats: videoData.formats ? videoData.formats.length : 0
                        };
                        
                        resolve(result);
                    } catch (parseError) {
                        reject(new Error(`Failed to parse yt-dlp output: ${parseError.message}`));
                    }
                } else {
                    reject(new Error(`yt-dlp failed with code ${code}: ${stderr}`));
                }
            });
            
            ytDlpProcess.on('error', (error) => {
                reject(new Error(`yt-dlp process error: ${error.message}`));
            });
        });
    }

    async getVideoInfoWithPoToken(videoUrl) {
        try {
            const result = await this.generatePoToken(videoUrl);
            return {
                success: true,
                data: result
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async downloadWithPoToken(videoUrl, outputPath) {
        try {
            console.log(`📥 Downloading with yt-dlp: ${videoUrl}`);
            
            return new Promise((resolve, reject) => {
                const { spawn } = require('child_process');
                
                // Enhanced yt-dlp download command
                const ytDlpArgs = [
                    '--output', outputPath,
                    '--format', 'best[ext=mp4]/best',
                    '--no-warnings',
                    '--no-check-certificate',
                    '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    '--add-header', 'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    '--add-header', 'Accept-Language: en-US,en;q=0.9',
                    '--add-header', 'Accept-Encoding: gzip, deflate, br',
                    '--add-header', 'DNT: 1',
                    '--add-header', 'Connection: keep-alive',
                    '--add-header', 'Upgrade-Insecure-Requests: 1',
                    videoUrl
                ];
                
                const ytDlpProcess = spawn('yt-dlp', ytDlpArgs);
                
                let stdout = '';
                let stderr = '';
                
                ytDlpProcess.stdout.on('data', (data) => {
                    stdout += data.toString();
                });
                
                ytDlpProcess.stderr.on('data', (data) => {
                    stderr += data.toString();
                });
                
                ytDlpProcess.on('close', (code) => {
                    if (code === 0) {
                        // Check if file was actually downloaded
                        const fs = require('fs');
                        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
                            resolve({
                                success: true,
                                filePath: outputPath,
                                method: 'yt-dlp-enhanced'
                            });
                        } else {
                            reject(new Error('Download completed but file is empty or missing'));
                        }
                    } else {
                        reject(new Error(`Download failed with code ${code}: ${stderr}`));
                    }
                });
                
                ytDlpProcess.on('error', (error) => {
                    reject(new Error(`Download process error: ${error.message}`));
                });
            });
        } catch (error) {
            throw error;
        }
    }
}

module.exports = new PoTokenController(); 